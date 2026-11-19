import "dotenv/config";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
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

function safeProxyJsonStatus(httpStatus: number): number {
  // Nginx reverse proxies with proxy_intercept_errors convert 403/502/503/504 into HTML pages.
  if (httpStatus === 403 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
    return 422;
  }
  return httpStatus;
}

async function createApp() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: "25mb" }));

  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(getGeminiClient()),
      timestamp: new Date().toISOString(),
    });
  };
  app.get("/api/health", healthHandler);
  app.get("/.netlify/functions/health", healthHandler);

  const analyzeTimePhotoHandler = async (req: express.Request, res: express.Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({
        error: "Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    const body = req.body || {};
    const rawImage =
      (typeof body.imageBase64 === "string" && body.imageBase64) ||
      (typeof body.imageDataUrl === "string" && body.imageDataUrl) ||
      (typeof body.image === "string" && body.image) ||
      "";
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

    if (!rawImage) {
      res.status(400).json({ error: "No image data was provided for analysis." });
      return;
    }

    const cleanBase64 = rawImage.replace(/^data:[^;]+;base64,/, "").trim();
    if (!cleanBase64) {
      res.status(400).json({ error: "No image data was provided for analysis." });
      return;
    }
    const modeLabel = mode === "time_out" ? "TIME OUT" : "TIME IN";

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

    const modelAttempts = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
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

        res.json({
          hasVisibleTime: Boolean(parsed.hasVisibleTime && validTime),
          time24: validTime,
          time12: typeof parsed.time12 === "string" ? parsed.time12.trim() : "",
          dateIso: validDate,
          locationText: typeof parsed.locationText === "string" ? parsed.locationText.trim() : "",
          confidence: typeof parsed.confidence === "string" ? parsed.confidence.trim() : "low",
          summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
        });
        return;
      } catch (err: unknown) {
        lastErr = err;
        const info = parseGeminiError(err);
        if (info.transient && idx < modelAttempts.length - 1) {
          await sleep(600 * (idx + 1) + Math.floor(Math.random() * 200));
          continue;
        }
        console.error("Time photo analysis error:", err);
        res.status(safeProxyJsonStatus(info.httpStatus)).json({
          error: info.message,
          upstreamStatus: info.httpStatus,
        });
        return;
      }
    }

    const finalInfo = parseGeminiError(lastErr);
    res.status(safeProxyJsonStatus(finalInfo.httpStatus)).json({
      error: finalInfo.message,
      upstreamStatus: finalInfo.httpStatus,
    });
  };

  app.post("/api/analyze-time-photo", analyzeTimePhotoHandler);
  app.post("/.netlify/functions/analyze-time-photo", analyzeTimePhotoHandler);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found." });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.path.startsWith("/api")) {
      next(err);
      return;
    }
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : "Server request error";
    res.status(status).json({ error: message });
  });

  if (!isProduction) {
    const { createServer } = await import("vite");
    const disableHmr = process.env.DISABLE_HMR === "true";
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: disableHmr ? false : true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found. Run npm run build first.");
      }
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`EESI Elevators server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch(err => {   console.error("Failed to start server:", err);   process.exit(1); });
