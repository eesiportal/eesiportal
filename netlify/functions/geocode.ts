interface GeocodeMatch {
  lat: number;
  lng: number;
  displayName?: string;
  formattedAddress: string;
  city?: string;
  regionHint?: string;
  source: "google_geocoding" | "google_places" | "photon" | "nominatim";
}

function expandGeocodeQueries(rawQueries: string[]): string[] {
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
}

async function tryServerPlacesTextSearch(query: string, apiKey: string): Promise<GeocodeMatch | null> {
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
}

export default async function handler(req: Request): Promise<Response> {
  const gKey =
    (typeof process !== "undefined" &&
      (process.env?.GOOGLE_MAPS_SERVER_KEY || process.env?.GOOGLE_MAPS_API_KEY || process.env?.VITE_GOOGLE_MAPS_API_KEY)) ||
    "";

  let rawQueries: string[] = [];
  let revLat = NaN;
  let revLng = NaN;
  if (req.method === "POST") {
    try {
      const body: any = await req.json();
      if (body?.lat !== undefined && body?.lat !== null && body?.lat !== "") revLat = Number(body.lat);
      if (body?.lng !== undefined && body?.lng !== null && body?.lng !== "") revLng = Number(body.lng);
      if (Array.isArray(body?.queries)) rawQueries = body.queries.map((q: unknown) => String(q || "").trim()).filter(Boolean);
      else if (typeof body?.q === "string" && body.q.trim()) rawQueries = [body.q.trim()];
    } catch {}
  } else {
    const url = new URL(req.url);
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");
    if (latParam) revLat = Number(latParam);
    if (lngParam) revLng = Number(lngParam);
    const single = url.searchParams.get("q");
    if (single && single.trim()) rawQueries.push(single.trim());
    url.searchParams.getAll("fallback").forEach(f => {
      if (f && f.trim()) rawQueries.push(f.trim());
    });
  }

  if (Number.isFinite(revLat) && Number.isFinite(revLng)) {
    const gRev = await tryGoogleReverseGeocode(revLat, revLng, gKey);
    if (gRev) {
      return new Response(JSON.stringify(gRev), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const pRev = await tryPhotonReverseGeocode(revLat, revLng);
    if (pRev) {
      return new Response(JSON.stringify(pRev), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const nRev = await tryNominatimReverseGeocode(revLat, revLng);
    if (nRev) {
      return new Response(JSON.stringify(nRev), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Address not found for coordinates" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const queries = expandGeocodeQueries(rawQueries);
  if (!queries.length) {
    return new Response(JSON.stringify({ error: "No address query provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const q of queries.slice(0, 4)) {
    const pHit = await tryServerPlacesTextSearch(q, gKey);
    if (pHit) {
      return new Response(JSON.stringify(pHit), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  for (const q of queries.slice(0, 5)) {
    const gMatch = await tryGoogleGeocode(q, gKey);
    if (gMatch) {
      return new Response(JSON.stringify(gMatch), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  for (const q of queries) {
    const pMatch = await tryPhotonGeocode(q);
    if (pMatch) {
      return new Response(JSON.stringify(pMatch), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  for (const q of queries) {
    const nMatch = await tryNominatimGeocode(q);
    if (nMatch) {
      return new Response(JSON.stringify(nMatch), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Location not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

function inferPhRegionFromGeo(text: string, lat?: number, lng?: number): "Luzon" | "Visayas" | "Mindanao" {
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
}

function extractGoogleCity(components: any[]): string {
  if (!Array.isArray(components)) return "";
  const pick = (t: string) => components.find(c => Array.isArray(c?.types) && c.types.includes(t))?.long_name || "";
  return String(pick("locality") || pick("administrative_area_level_3") || pick("administrative_area_level_2") || pick("sublocality_level_1") || "").trim();
}

function extractNominatimCity(addr: any): string {
  if (!addr || typeof addr !== "object") return "";
  return String(addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.state_district || "").trim();
}

async function tryGoogleGeocode(query: string, apiKey: string): Promise<GeocodeMatch | null> {
  if (!apiKey || apiKey === "MY_GOOGLE_MAPS_API_KEY") return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}` +
      `&region=ph&key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    if (j?.status !== "OK" || !Array.isArray(j.results) || !j.results.length) return null;
    const top = j.results[0];
    const lat = Number(top?.geometry?.location?.lat);
    const lng = Number(top?.geometry?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const formattedAddress = String(top.formatted_address || query);
    const city = extractGoogleCity(top.address_components || []);
    return {
      lat,
      lng,
      formattedAddress,
      city,
      regionHint: inferPhRegionFromGeo(`${query} ${city} ${formattedAddress}`, lat, lng),
      source: "google_geocoding",
    };
  } catch {
    return null;
  }
}

async function tryGoogleReverseGeocode(lat: number, lng: number, apiKey: string): Promise<GeocodeMatch | null> {
  if (!apiKey || apiKey === "MY_GOOGLE_MAPS_API_KEY") return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat + "," + lng)}&key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    if (j?.status !== "OK" || !Array.isArray(j.results) || !j.results.length) return null;
    const top = j.results[0];
    const formattedAddress = String(top.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    const city = extractGoogleCity(top.address_components || []);
    return {
      lat,
      lng,
      formattedAddress,
      city,
      regionHint: inferPhRegionFromGeo(`${city} ${formattedAddress}`, lat, lng),
      source: "google_geocoding",
    };
  } catch {
    return null;
  }
}

async function tryNominatimGeocode(query: string): Promise<GeocodeMatch | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=ph` +
      `&q=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "EESI-Elevators-Console/1.0 (operations-geocoder)",
        Accept: "application/json",
      },
    });
    if (!r.ok) return null;
    const arr: any = await r.json();
    if (!Array.isArray(arr) || !arr.length) return null;
    const top = arr[0];
    const lat = Number(top?.lat);
    const lng = Number(top?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const formattedAddress = String(top?.display_name || query);
    const city = extractNominatimCity(top?.address);
    return {
      lat,
      lng,
      displayName: String(top?.name || ""),
      formattedAddress,
      city,
      regionHint: inferPhRegionFromGeo(`${query} ${city} ${formattedAddress}`, lat, lng),
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

function formatPhotonFeature(feat: any, fallbackLat?: number, fallbackLng?: number): GeocodeMatch | null {
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
    if (!deduped.some(existing => existing.toLowerCase() === part.toLowerCase())) deduped.push(part);
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
}

async function tryPhotonGeocode(query: string): Promise<GeocodeMatch | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=12.8797&lon=121.7740&limit=5`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const fc: any = await r.json();
    const feats: any[] = Array.isArray(fc?.features) ? fc.features : [];
    const phFeat = feats.find(f => String(f?.properties?.countrycode || "").toUpperCase() === "PH") || feats[0];
    return phFeat ? formatPhotonFeature(phFeat) : null;
  } catch {
    return null;
  }
}

async function tryPhotonReverseGeocode(lat: number, lng: number): Promise<GeocodeMatch | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const fc: any = await r.json();
    const feat = Array.isArray(fc?.features) ? fc.features[0] : null;
    const hit = feat ? formatPhotonFeature(feat, lat, lng) : null;
    return hit ? { ...hit, lat, lng } : null;
  } catch {
    return null;
  }
}

async function tryNominatimReverseGeocode(lat: number, lng: number): Promise<GeocodeMatch | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "EESI-Elevators-Console/1.0 (operations-geocoder)",
        Accept: "application/json",
      },
    });
    if (!r.ok) return null;
    const top: any = await r.json();
    if (!top || (!top.display_name && !top.address)) return null;
    const formattedAddress = String(top.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    const city = extractNominatimCity(top.address);
    return {
      lat,
      lng,
      displayName: String(top.name || ""),
      formattedAddress,
      city,
      regionHint: inferPhRegionFromGeo(`${city} ${formattedAddress}`, lat, lng),
      source: "nominatim",
    };
  } catch {
    return null;
  }
}
