import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parseGeminiError(err: unknown): { httpStatus: number; message: string; transient: boolean } {
  const raw = err instanceof Error ? err.message : String(err || "Vision analysis failed");
  let code = 0;
  let cleanMsg = raw;

  try {
    const outer = JSON.parse(raw);
    const inner = outer?.error ?? outer;
    if (typeof inner?.code === "number") code = inner.code;
    if (typeof inner?.message === "string" && inner.message.trim()) {
      cleanMsg = inner.message.trim();
      if (cleanMsg.startsWith("{")) {
        try {
          const nested = JSON.parse(cleanMsg);
          const nestedErr = nested?.error ?? nested;
          if (typeof nestedErr?.code === "number") code = nestedErr.code;
          if (typeof nestedErr?.message === "string" && nestedErr.message.trim()) {
            cleanMsg = nestedErr.message.trim();
          }
        } catch {}
      }
    }
  } catch {
    const statusProp = (err as { status?: number })?.status;
    if (typeof statusProp === "number") code = statusProp;
  }

  const transient =
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|timed out|ECONNRESET/i.test(raw);

  if (code === 503 || /UNAVAILABLE|high demand/i.test(cleanMsg)) {
    return {
      httpStatus: 503,
      message: "AI vision service is temporarily busy. Please wait a few seconds and try uploading again.",
      transient: true,
    };
  }
  if (code === 429 || /RESOURCE_EXHAUSTED|rate limit/i.test(cleanMsg)) {
    return {
      httpStatus: 429,
      message: "AI request limit reached briefly. Please try again in a moment.",
      transient: true,
    };
  }
  return {
    httpStatus: code >= 400 && code < 600 ? code : 502,
    message: cleanMsg || "Vision analysis failed.",
    transient,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      val => {
        clearTimeout(timer);
        resolve(val);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey =
    typeof process !== "undefined" ? (process.env?.GEMINI_API_KEY || process.env?.GOOGLE_API_KEY) : undefined;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return jsonResponse(500, {
      error: "Gemini API key is not configured on Netlify. Set GEMINI_API_KEY in Site Environment Variables.",
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON request body." });
  }

  const rawImage =
    (typeof body.imageBase64 === "string" && body.imageBase64) ||
    (typeof body.imageDataUrl === "string" && body.imageDataUrl) ||
    (typeof body.image === "string" && body.image) ||
    "";

  if (!rawImage) {
    return jsonResponse(400, { error: "No image data was provided for analysis." });
  }

  const cleanBase64 = rawImage.replace(/^data:[^;]+;base64,/, "").trim();
  if (!cleanBase64) {
    return jsonResponse(400, { error: "No image data was provided for analysis." });
  }

  const dataUrlMimeMatch = rawImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.startsWith("image/")
      ? body.mimeType
      : dataUrlMimeMatch
        ? dataUrlMimeMatch[1].toLowerCase()
        : "image/jpeg";
  const mode = body.mode === "time_out" ? "time_out" : "time_in";
  const expectedDate =
    typeof body.expectedDate === "string" && body.expectedDate
      ? body.expectedDate
      : new Date().toISOString().slice(0, 10);
  const modeLabel = mode === "time_out" ? "TIME OUT" : "TIME IN";

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const promptText =
    `You are verifying an employee ${modeLabel} check-in photo for a Daily Time Record (DTR) system.\n` +
    `Carefully inspect the uploaded photo for ANY visible time, timestamp watermark (such as "Nov 19, 2026, 1:22 AM"), ` +
    `GPS Map Camera overlay, timecard/bundy clock printout, biometric terminal screen, digital clock, watch, or phone clock.\n` +
    `- If a clear time is visible on the photo, extract it strictly in 24-hour HH:MM format with leading zero (for example "01:22", "08:05", or "17:42") and 12-hour format (e.g. "1:22 AM"), and set hasVisibleTime=true.\n` +
    `- If multiple timestamps appear, pick the primary capture/check-in timestamp most prominently stamped or shown on the photo.\n` +
    `- Extract the visible date in YYYY-MM-DD format if shown on the photo (for example "Nov 19, 2026" -> "2026-11-19", otherwise empty string; reference today is ${expectedDate}).\n` +
    `- Extract any visible location/site/GPS address watermark text into locationText (otherwise empty string).\n` +
    `- If NO time digits or clock are visible anywhere in the photo, set hasVisibleTime=false, time24="", time12="", confidence="low", and explain in summary why no time could be read.\n` +
    `- NEVER invent or guess a time that is not visibly shown in the image.`;

  const modelAttempts = ["gemini-4-hydrogen", "gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErr: unknown = null;

  for (let idx = 0; idx < modelAttempts.length; idx++) {
    const modelName = modelAttempts[idx];
    try {
      const thinkingLevel =
        modelName === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel },
            systemInstruction:
              "Extract exact visible timestamps and location overlays from employee DTR verification photos. Never fabricate unprinted times.",
            responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasVisibleTime: {
                type: Type.BOOLEAN,
                description: "True only if a clear time reading or timestamp watermark is visibly readable in the photo.",
              },
              time24: {
                type: Type.STRING,
                description: "Extracted time in 24-hour HH:MM format (e.g., 01:22, 08:05, or 17:30), or empty string if none visible.",
              },
              time12: {
                type: Type.STRING,
                description: "Extracted time in 12-hour format (e.g., 1:22 AM or 8:05 AM), or empty string if none visible.",
              },
              dateIso: {
                type: Type.STRING,
                description: "Visible date in YYYY-MM-DD format, or empty string if not visible.",
              },
              locationText: {
                type: Type.STRING,
                description: "Visible site name, address, or GPS overlay text, or empty string.",
              },
              confidence: {
                type: Type.STRING,
                description: "high, medium, or low confidence based on text legibility.",
              },
              summary: {
                type: Type.STRING,
                description: "Short plain-text summary describing what time/details were read from the photo.",
              },
            },
            required: ["hasVisibleTime", "time24", "time12", "dateIso", "locationText", "confidence", "summary"],
          },
        },
      }),
      18000,
      `Gemini ${modelName}`
    );

      const rawText = (response.text || "{}").trim();
      const parsed = JSON.parse(rawText);
      const rawTime = typeof parsed.time24 === "string" ? parsed.time24.trim() : "";
      const timeMatch = rawTime.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
      const normalizedHour = timeMatch ? Number(timeMatch[1]) : -1;
      const validTime =
        timeMatch && normalizedHour >= 0 && normalizedHour <= 23
          ? String(normalizedHour).padStart(2, "0") + ":" + timeMatch[2]
          : "";
      const validDate =
        typeof parsed.dateIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateIso.trim())
          ? parsed.dateIso.trim()
          : "";

      return jsonResponse(200, {
        hasVisibleTime: Boolean(parsed.hasVisibleTime && validTime),
        time24: validTime,
        time12: typeof parsed.time12 === "string" ? parsed.time12.trim() : "",
        dateIso: validDate,
        locationText: typeof parsed.locationText === "string" ? parsed.locationText.trim() : "",
        confidence: typeof parsed.confidence === "string" ? parsed.confidence.trim() : "low",
        summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      });
    } catch (err: unknown) {
      lastErr = err;
      const info = parseGeminiError(err);
      if (info.transient && idx < modelAttempts.length - 1) {
        await sleep(700 * (idx + 1) + Math.floor(Math.random() * 250));
        continue;
      }
      console.error("Netlify time photo analysis error:", err);
      return jsonResponse(info.httpStatus, { error: info.message });
    }
  }

  const finalInfo = parseGeminiError(lastErr);
  return jsonResponse(finalInfo.httpStatus, { error: finalInfo.message });
}
