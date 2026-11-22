function isAcceptableRasterUrl(u: string): boolean {
  const low = String(u || "").toLowerCase();
  if (!low.startsWith("http")) return false;
  if (/\.svg(\?|$)/i.test(low)) return false;
  if (/(logo|icon|flag_of|coat_of_arms|map_of|locator_map|blank|placeholder|stub|wordmark)/i.test(low)) return false;
  return /\.(jpe?g|png|webp)(\?|$)/i.test(low) || low.includes("upload.wikimedia.org") || low.includes("thumb.wikimedia.org");
}

function latLngToOsmTile(lat: number, lng: number, zoom = 16) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { z: zoom, x, y };
}

export default async function handler(req: Request): Promise<Response> {
  const urlObj = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {}
  }

  const wantTile = String(urlObj.searchParams.get("tile") || body.tile || "") === "1";
  const lat = Number(req.method === "POST" ? body.lat : urlObj.searchParams.get("lat"));
  const lng = Number(req.method === "POST" ? body.lng : urlObj.searchParams.get("lng"));

  if (wantTile) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ error: "Valid lat and lng are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const zoom = Math.min(18, Math.max(12, Number(urlObj.searchParams.get("z") || body.z || 16) || 16));
    const { x, y } = latLngToOsmTile(lat, lng, zoom);
    try {
      const tileRes = await fetch(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`, {
        headers: { "User-Agent": "EESI-Elevators-Console/1.0 (site-preview)" },
      });
      if (!tileRes.ok) {
        return new Response(JSON.stringify({ error: "Map tile unavailable." }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      const buf = await tileRes.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": tileRes.headers.get("content-type") || "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Map tile fetch failed." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const q = String((req.method === "POST" ? body.q : urlObj.searchParams.get("q")) || "").trim();
  const city = String((req.method === "POST" ? body.city : urlObj.searchParams.get("city")) || "").trim();
  if (!q && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return new Response(JSON.stringify({ error: "Site name or coordinates required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cleanQ = q.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const searchTerms = [...new Set([cleanQ, city ? `${cleanQ} ${city}` : ""].filter(Boolean))];

  for (const term of searchTerms) {
    try {
      const u =
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
        `&gsrsearch=${encodeURIComponent(term)}&gsrlimit=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
      const r = await fetch(u, { headers: { "User-Agent": "EESI-Elevators-Console/1.0" } });
      if (r.ok) {
        const j: any = await r.json();
        const pages = Object.values(j?.query?.pages || {}) as any[];
        pages.sort((a, b) => (a.index || 99) - (b.index || 99));
        for (const page of pages) {
          const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
          const candidate = String(info?.thumburl || info?.url || "");
          const mime = String(info?.mime || "").toLowerCase();
          if (candidate && (!mime || (mime.startsWith("image/") && !mime.includes("svg"))) && isAcceptableRasterUrl(candidate)) {
            return new Response(JSON.stringify({ photoUrl: candidate, source: "wikimedia", title: String(page?.title || term) }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
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
      const r = await fetch(u, { headers: { "User-Agent": "EESI-Elevators-Console/1.0" } });
      if (r.ok) {
        const j: any = await r.json();
        const pages = Object.values(j?.query?.pages || {}) as any[];
        pages.sort((a, b) => (a.index || 99) - (b.index || 99));
        for (const page of pages) {
          const candidate = String(page?.thumbnail?.source || "");
          if (candidate && isAcceptableRasterUrl(candidate)) {
            return new Response(JSON.stringify({ photoUrl: candidate, source: "wikipedia", title: String(page?.title || term) }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
    } catch {}
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return new Response(
      JSON.stringify({
        photoUrl: `/api/site-photo?tile=1&lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
        source: "osm_tile",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "No site photo found." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
