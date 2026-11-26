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

function getGeminiClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
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

function extractInteractionText(interaction: any): string {
  if (typeof interaction?.output_text === "string" && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }
  const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
  let combined = "";
  for (const step of steps) {
    if (step?.type === "model_output" && Array.isArray(step?.content)) {
      for (const part of step.content) {
        if (part?.type === "text" && typeof part.text === "string") {
          combined += part.text;
        }
      }
    }
  }
  return combined.trim();
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
    const aiBeta = getGeminiClient("v1beta");
    if (!ai || !aiBeta) {
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

    const responseSchema = {
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
    };

    const attempts: Array<{ kind: "interactions" | "generateContent"; model: string; timeoutMs: number }> = [
      { kind: "interactions", model: "gemini-4-hydrogen", timeoutMs: 6000 },
      { kind: "interactions", model: "gemini-3.1-flash-lite", timeoutMs: 7000 },
      { kind: "generateContent", model: "gemini-3.1-flash-lite", timeoutMs: 9000 },
      { kind: "generateContent", model: "gemini-4-hydrogen", timeoutMs: 10000 },
    ];
    let lastErr: unknown = null;

    for (let idx = 0; idx < attempts.length; idx++) {
      const attempt = attempts[idx];
      try {
        let rawText = "{}";
        if (attempt.kind === "interactions") {
          const interaction = await withTimeout(
            aiBeta.interactions.create({
              model: attempt.model,
              store: false,
              system_instruction:
                "Extract exact visible timestamps and location overlays from employee DTR verification photos. Never fabricate unprinted times.",
              input: [
                {
                  type: "image",
                  data: cleanBase64,
                  mime_type: mimeType,
                },
                {
                  type: "text",
                  text: promptText,
                },
              ],
              generation_config: {
                thinking_level: attempt.model === "gemini-3.1-flash-lite" ? "minimal" : "low",
              },
              response_format: responseSchema as any,
            }),
            attempt.timeoutMs,
            `Gemini Interactions ${attempt.model}`
          );
          rawText = extractInteractionText(interaction) || "{}";
        } else {
          const thinkingLevel = attempt.model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
          const response = await withTimeout(
            ai.models.generateContent({
              model: attempt.model,
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
                responseSchema,
              },
            }),
            attempt.timeoutMs,
            `Gemini ${attempt.model}`
          );
          rawText = (response.text || "{}").trim();
        }

        const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
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
        const canFallback =
          info.transient ||
          attempt.kind === "interactions" ||
          info.httpStatus === 404 ||
          /no longer available|not found|unsupported/i.test(info.message);
        if (canFallback && idx < attempts.length - 1) {
          await sleep(150);
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

  const geocodeCache = new Map<
    string,
    { lat: number; lng: number; displayName?: string; formattedAddress: string; city?: string; regionHint?: string; source: string }
  >();
  const inferPhRegionFromGeo = (text: string, lat?: number, lng?: number): "Luzon" | "Visayas" | "Mindanao" => {
    const low = String(text || "").toLowerCase();
    if (/(davao|cagayan de oro|zamboanga|general santos|gensan|butuan|iligan|surigao|cotabato|mindanao|dipolog|pagadian|tagum|koronadal|valencia|malaybalay|caraga|soccsksargen|barmm|bukidnon|agusan|misamis)/i.test(low)) {
      return "Mindanao";
    }
    if (/(cebu|mandaue|lapu-lapu|talisay|consolacion|liloan|iloilo|bacolod|negros|tacloban|ormoc|bohol|tagbilaran|dumaguete|kalibo|boracay|aklan|capiz|roxas|leyte|samar|visayas|bantayan|camotes|siquijor|antique|guimaras)/i.test(low)) {
      return "Visayas";
    }
    if (/(manila|makati|taguig|bgc|pasig|ortigas|quezon city|mandaluyong|pasay|paranaque|para\u00f1aque|muntinlupa|alabang|las pinas|caloocan|marikina|san juan|valenzuela|tagaytay|cavite|laguna|batangas|rizal|bulacan|pampanga|clark|angeles|subic|zambales|baguio|benguet|tarlac|pangasinan|bicol|naga|legazpi|luzon|ncr|metro manila|ilocos|la union|isabela|cagayan|palawan|puerto princesa|mindoro)/i.test(low)) {
      return "Luzon";
    }
    if (typeof lat === "number" && Number.isFinite(lat)) {
      if (lat >= 12.6) return "Luzon";
      if (lat >= 9.15 && (lng === undefined || lng < 126.3)) return "Visayas";
      return "Mindanao";
    }
    return "Visayas";
  };
  const extractGoogleCity = (components: any[]): string => {
    if (!Array.isArray(components)) return "";
    const pick = (t: string) => components.find(c => Array.isArray(c?.types) && c.types.includes(t))?.long_name || "";
    return String(pick("locality") || pick("administrative_area_level_3") || pick("administrative_area_level_2") || pick("sublocality_level_1") || "").trim();
  };
  const extractNominatimCity = (addr: any): string => {
    if (!addr || typeof addr !== "object") return "";
    return String(addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.state_district || "").trim();
  };
  const formatPhotonFeature = (feat: any, fallbackLat?: number, fallbackLng?: number) => {
    const p = feat?.properties || {};
    const coords = Array.isArray(feat?.geometry?.coordinates) ? feat.geometry.coordinates : [];
    const lng = Number(coords[0] ?? fallbackLng);
    const lat = Number(coords[1] ?? fallbackLat);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ").trim();
    const areaLine = String(p.locality || p.district || "").trim();
    const city = String(p.city || p.county || p.town || p.village || p.state_district || "").trim();
    const parts = [p.name, streetLine, areaLine, city, p.state, p.country]
      .map(v => String(v || "").trim())
      .filter(Boolean);
    const deduped: string[] = [];
    parts.forEach(part => {
      if (!deduped.some(existing => existing.toLowerCase() === part.toLowerCase())) {
        deduped.push(part);
      }
    });
    const formattedAddress = deduped.join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return {
      lat,
      lng,
      displayName: String(p.name || streetLine || city || ""),
      formattedAddress,
      city,
      regionHint: inferPhRegionFromGeo(`${p.name || ""} ${city} ${p.state || ""} ${formattedAddress}`, lat, lng),
      source: "photon",
    };
  };

  const expandGeocodeQueries = (rawQueries: string[]): string[] => {
    const out: string[] = [];
    const push = (v: string) => {
      const cleaned = v.replace(/\s*,\s*,+/g, ",").replace(/^[\s,]+|[\s,]+$/g, "").replace(/\s+/g, " ").trim();
      if (cleaned && !out.some(x => x.toLowerCase() === cleaned.toLowerCase())) {
        out.push(cleaned);
      }
    };
    const isRegionOnly = (v: string) => /^(visayas|luzon|mindanao)(,\s*philippines)?$/i.test(v.trim());
    for (const raw of rawQueries) {
      const base = String(raw || "").trim();
      if (!base || isRegionOnly(base)) continue;
      push(base);
      const noParens = base.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
      if (noParens && !isRegionOnly(noParens)) push(noParens);
      const noIsland = noParens
        .replace(/,\s*(visayas|luzon|mindanao)\b/gi, "")
        .replace(/\b(visayas|luzon|mindanao)\s*,/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (noIsland && !isRegionOnly(noIsland)) push(noIsland);
      if (noIsland && !/philippines/i.test(noIsland)) {
        push(`${noIsland}, Philippines`);
      }
    }
    return out.slice(0, 10);
  };

  const tryServerPlacesTextSearch = async (query: string, apiKey: string) => {
    if (!apiKey || apiKey === "MY_GOOGLE_MAPS_API_KEY") return null;
    try {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.addressComponents",
        },
        body: JSON.stringify({
          textQuery: query,
          regionCode: "PH",
          maxResultCount: 1,
        }),
        signal: AbortSignal.timeout(4500),
      });
      if (!r.ok) return null;
      const j: any = await r.json();
      const top = Array.isArray(j?.places) ? j.places[0] : null;
      const lat = Number(top?.location?.latitude);
      const lng = Number(top?.location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const formattedAddress = String(top?.formattedAddress || query);
      const displayName = String(top?.displayName?.text || "");
      const comps = Array.isArray(top?.addressComponents) ? top.addressComponents : [];
      const pickComp = (t: string) => comps.find((c: any) => Array.isArray(c?.types) && c.types.includes(t))?.longText || "";
      const city = String(pickComp("locality") || pickComp("administrative_area_level_3") || pickComp("administrative_area_level_2") || "").trim();
      return {
        lat,
        lng,
        displayName,
        formattedAddress,
        city,
        regionHint: inferPhRegionFromGeo(`${query} ${city} ${formattedAddress}`, lat, lng),
        source: "google_places",
      };
    } catch {
      return null;
    }
  };

  const geocodeHandler = async (req: express.Request, res: express.Response) => {
    const body = req.method === "POST" ? (req.body || {}) : {};
    const rawLat = req.method === "POST" ? body.lat : req.query.lat;
    const rawLng = req.method === "POST" ? body.lng : req.query.lng;
    const revLat = rawLat !== undefined && rawLat !== null && rawLat !== "" ? Number(rawLat) : NaN;
    const revLng = rawLng !== undefined && rawLng !== null && rawLng !== "" ? Number(rawLng) : NaN;

    const gKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";

    if (Number.isFinite(revLat) && Number.isFinite(revLng)) {
      const revKey = `rev:${revLat.toFixed(5)},${revLng.toFixed(5)}`;
      const revCached = geocodeCache.get(revKey);
      if (revCached) {
        res.json(revCached);
        return;
      }
      if (gKey && gKey !== "MY_GOOGLE_MAPS_API_KEY") {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(revLat + "," + revLng)}&key=${encodeURIComponent(gKey)}`;
          const r = await fetch(url, { signal: AbortSignal.timeout(4500) });
          if (r.ok) {
            const j: any = await r.json();
            if (j?.status === "OK" && Array.isArray(j.results) && j.results.length) {
              const top = j.results[0];
              const formattedAddress = String(top.formatted_address || `${revLat.toFixed(5)}, ${revLng.toFixed(5)}`);
              const city = extractGoogleCity(top.address_components || []);
              const hit = {
                lat: revLat,
                lng: revLng,
                formattedAddress,
                city,
                regionHint: inferPhRegionFromGeo(`${city} ${formattedAddress}`, revLat, revLng),
                source: "google_geocoding",
              };
              geocodeCache.set(revKey, hit);
              res.json(hit);
              return;
            }
          }
        } catch {}
      }
      try {
        const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(String(revLat))}&lon=${encodeURIComponent(String(revLng))}`;
        const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4500) });
        if (r.ok) {
          const fc: any = await r.json();
          const feat = Array.isArray(fc?.features) ? fc.features[0] : null;
          const formatted = feat ? formatPhotonFeature(feat, revLat, revLng) : null;
          if (formatted) {
            const hit = { ...formatted, lat: revLat, lng: revLng };
            geocodeCache.set(revKey, hit);
            res.json(hit);
            return;
          }
        }
      } catch {}
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(revLat))}&lon=${encodeURIComponent(String(revLng))}`;
        const r = await fetch(url, {
          headers: {
            "User-Agent": "EESI-Elevators-Console/1.0 (operations-geocoder)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(4500),
        });
        if (r.ok) {
          const top: any = await r.json();
          if (top && (top.display_name || top.address)) {
            const formattedAddress = String(top.display_name || `${revLat.toFixed(5)}, ${revLng.toFixed(5)}`);
            const city = extractNominatimCity(top.address);
            const hit = {
              lat: revLat,
              lng: revLng,
              displayName: String(top.name || ""),
              formattedAddress,
              city,
              regionHint: inferPhRegionFromGeo(`${city} ${formattedAddress}`, revLat, revLng),
              source: "nominatim",
            };
            geocodeCache.set(revKey, hit);
            res.json(hit);
            return;
          }
        }
      } catch {}
      res.status(404).json({ error: "Address not found for coordinates" });
      return;
    }

    let rawQueries: string[] = [];
    if (req.method === "POST") {
      if (Array.isArray(body.queries)) {
        rawQueries = body.queries.map((q: unknown) => String(q || "").trim()).filter(Boolean);
      } else if (typeof body.q === "string" && body.q.trim()) {
        rawQueries = [body.q.trim()];
      }
    } else {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (q) rawQueries.push(q);
      const fb = req.query.fallback;
      if (typeof fb === "string" && fb.trim()) rawQueries.push(fb.trim());
      else if (Array.isArray(fb)) fb.forEach(item => { const s = String(item || "").trim(); if (s) rawQueries.push(s); });
    }
    const queries = expandGeocodeQueries(rawQueries);
    if (!queries.length) {
      res.status(400).json({ error: "No address query provided." });
      return;
    }

    const cacheKey = queries[0].toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    if (gKey && gKey !== "MY_GOOGLE_MAPS_API_KEY") {
      for (const q of queries.slice(0, 4)) {
        const pHit = await tryServerPlacesTextSearch(q, gKey);
        if (pHit) {
          geocodeCache.set(cacheKey, pHit);
          res.json(pHit);
          return;
        }
      }
      for (const q of queries.slice(0, 5)) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ph&key=${encodeURIComponent(gKey)}`;
          const r = await fetch(url, { signal: AbortSignal.timeout(4500) });
          if (r.ok) {
            const j: any = await r.json();
            if (j?.status === "OK" && Array.isArray(j.results) && j.results.length) {
              const top = j.results[0];
              const lat = Number(top?.geometry?.location?.lat);
              const lng = Number(top?.geometry?.location?.lng);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                const formattedAddress = String(top.formatted_address || q);
                const city = extractGoogleCity(top.address_components || []);
                const hit = {
                  lat,
                  lng,
                  formattedAddress,
                  city,
                  regionHint: inferPhRegionFromGeo(`${q} ${city} ${formattedAddress}`, lat, lng),
                  source: "google_geocoding",
                };
                geocodeCache.set(cacheKey, hit);
                res.json(hit);
                return;
              }
            }
          }
        } catch {}
      }
    }

    for (const q of queries) {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=12.8797&lon=121.7740&limit=5`;
        const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4500) });
        if (r.ok) {
          const fc: any = await r.json();
          const feats: any[] = Array.isArray(fc?.features) ? fc.features : [];
          const phFeat =
            feats.find(f => String(f?.properties?.countrycode || "").toUpperCase() === "PH") ||
            feats[0];
          const hit = phFeat ? formatPhotonFeature(phFeat) : null;
          if (hit) {
            geocodeCache.set(cacheKey, hit);
            res.json(hit);
            return;
          }
        }
      } catch {}
    }

    for (const q of queries) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, {
          headers: {
            "User-Agent": "EESI-Elevators-Console/1.0 (operations-geocoder)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(4500),
        });
        if (r.ok) {
          const arr: any = await r.json();
          if (Array.isArray(arr) && arr.length) {
            const top = arr[0];
            const lat = Number(top?.lat);
            const lng = Number(top?.lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const formattedAddress = String(top?.display_name || q);
              const city = extractNominatimCity(top?.address);
              const hit = {
                lat,
                lng,
                displayName: String(top?.name || ""),
                formattedAddress,
                city,
                regionHint: inferPhRegionFromGeo(`${q} ${city} ${formattedAddress}`, lat, lng),
                source: "nominatim",
              };
              geocodeCache.set(cacheKey, hit);
              res.json(hit);
              return;
            }
          }
        }
      } catch {}
    }

    res.status(404).json({ error: "Location not found" });
  };
  app.get("/api/geocode", geocodeHandler);
  app.post("/api/geocode", geocodeHandler);
  app.get("/.netlify/functions/geocode", geocodeHandler);
  app.post("/.netlify/functions/geocode", geocodeHandler);

  const sitePhotoCache = new Map<string, { photoUrl: string; source: string; title?: string }>();
  const isAcceptableRasterUrl = (u: string): boolean => {
    const low = String(u || "").toLowerCase();
    if (!low.startsWith("http")) return false;
    if (/\.svg(\?|$)/i.test(low)) return false;
    if (/(logo|icon|flag_of|coat_of_arms|map_of|locator_map|blank|placeholder|stub|wordmark)/i.test(low)) return false;
    return /\.(jpe?g|png|webp)(\?|$)/i.test(low) || low.includes("upload.wikimedia.org") || low.includes("thumb.wikimedia.org");
  };
  const latLngToOsmTile = (lat: number, lng: number, zoom = 16) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { z: zoom, x, y };
  };

  const sitePhotoHandler = async (req: express.Request, res: express.Response) => {
    const body = req.method === "POST" ? (req.body || {}) : {};
    const wantTile = String(req.query.tile || body.tile || "") === "1";
    const wantSat = String(req.query.sat || body.sat || "") === "1";
    const lat = Number(req.method === "POST" ? body.lat : req.query.lat);
    const lng = Number(req.method === "POST" ? body.lng : req.query.lng);

    if (wantTile) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: "Valid lat and lng are required for tile preview." });
        return;
      }
      const zoom = Math.min(18, Math.max(12, Number(req.query.z || body.z || 16) || 16));
      if (wantSat) {
        const gKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
        if (gKey && gKey !== "MY_GOOGLE_MAPS_API_KEY") {
          try {
            const gUrl =
              `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}` +
              `&size=240x240&scale=2&maptype=hybrid&markers=color:red%7C${lat},${lng}&key=${encodeURIComponent(gKey)}`;
            const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(6000) });
            if (gRes.ok && /^image\//i.test(gRes.headers.get("content-type") || "")) {
              const buf = Buffer.from(await gRes.arrayBuffer());
              res.setHeader("Content-Type", gRes.headers.get("content-type") || "image/png");
              res.setHeader("Cache-Control", "public, max-age=3600");
              res.send(buf);
              return;
            }
          } catch {}
        }
      }
      const { x, y } = latLngToOsmTile(lat, lng, zoom);
      const tileUrls = wantSat
        ? [
            `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`,
            `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
          ]
        : [`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`];
      for (const tUrl of tileUrls) {
        try {
          const tileRes = await fetch(tUrl, {
            headers: { "User-Agent": "EESI-Elevators-Console/1.0 (site-preview)" },
            signal: AbortSignal.timeout(6000),
          });
          if (!tileRes.ok) continue;
          const buf = Buffer.from(await tileRes.arrayBuffer());
          res.setHeader("Content-Type", tileRes.headers.get("content-type") || "image/png");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.send(buf);
          return;
        } catch {}
      }
      res.status(502).json({ error: "Map tile fetch failed." });
      return;
    }

    const q = String((req.method === "POST" ? body.q : req.query.q) || "").trim();
    const city = String((req.method === "POST" ? body.city : req.query.city) || "").trim();
    if (!q && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      res.status(400).json({ error: "Site name or coordinates required." });
      return;
    }

    const cacheKey = `${q.toLowerCase()}|${city.toLowerCase()}`;
    const cached = sitePhotoCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const cleanQ = q.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const searchTerms = [...new Set([cleanQ, city ? `${cleanQ} ${city}` : ""].filter(Boolean))];

    for (const term of searchTerms) {
      try {
        const u =
          `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
          `&gsrsearch=${encodeURIComponent(term)}&gsrlimit=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
        const r = await fetch(u, { headers: { "User-Agent": "EESI-Elevators-Console/1.0" }, signal: AbortSignal.timeout(6000) });
        if (r.ok) {
          const j: any = await r.json();
          const pages = Object.values(j?.query?.pages || {}) as any[];
          pages.sort((a, b) => (a.index || 99) - (b.index || 99));
          for (const page of pages) {
            const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
            const candidate = String(info?.thumburl || info?.url || "");
            const mime = String(info?.mime || "").toLowerCase();
            if (candidate && (!mime || (mime.startsWith("image/") && !mime.includes("svg"))) && isAcceptableRasterUrl(candidate)) {
              const hit = { photoUrl: candidate, source: "wikimedia", title: String(page?.title || term) };
              sitePhotoCache.set(cacheKey, hit);
              res.json(hit);
              return;
            }
          }
        }
      } catch {}
    }

    for (const term of searchTerms) {
      try {
        const u =
          `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
          `&gsrsearch=${encodeURIComponent(term)}&gsrlimit=4&prop=pageimages&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;
        const r = await fetch(u, { headers: { "User-Agent": "EESI-Elevators-Console/1.0" }, signal: AbortSignal.timeout(6000) });
        if (r.ok) {
          const j: any = await r.json();
          const pages = Object.values(j?.query?.pages || {}) as any[];
          pages.sort((a, b) => (a.index || 99) - (b.index || 99));
          for (const page of pages) {
            const candidate = String(page?.thumbnail?.source || "");
            if (candidate && isAcceptableRasterUrl(candidate)) {
              const hit = { photoUrl: candidate, source: "wikipedia", title: String(page?.title || term) };
              sitePhotoCache.set(cacheKey, hit);
              res.json(hit);
              return;
            }
          }
        }
      } catch {}
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      res.json({
        photoUrl: `/api/site-photo?tile=1&lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
        source: "osm_tile",
      });
      return;
    }

    res.status(404).json({ error: "No site photo found." });
  };
  app.get("/api/site-photo", sitePhotoHandler);
  app.post("/api/site-photo", sitePhotoHandler);
  app.get("/.netlify/functions/site-photo", sitePhotoHandler);
  app.post("/.netlify/functions/site-photo", sitePhotoHandler);

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
