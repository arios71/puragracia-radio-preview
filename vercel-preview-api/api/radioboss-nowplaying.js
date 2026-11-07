const ALLOWED_ORIGINS = new Set([
  "https://arios71.github.io"
]);

const PRODUCTION_FOLDERS = new Set([
  "Jingles",
  "Station ID",
  "Stingers",
  "Sweepers"
]);

function isProductionFile(filename) {
  const folders = String(filename || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  return folders.some(folder => PRODUCTION_FOLDERS.has(folder));
}

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiUrl = process.env.RADIOBOSS_API_URL;
  const apiKey = process.env.RADIOBOSS_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(500).json({
      ok: false,
      error: "RadioBOSS API environment variables are not configured"
    });
  }

  try {
    const upstreamUrl = new URL(apiUrl);
    upstreamUrl.searchParams.set("key", apiKey);

    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: "RadioBOSS API request failed",
        upstreamStatus: upstream.status
      });
    }

    const payload = await upstream.json();
    const attributes = payload?.currenttrack_info?.["@attributes"] || {};
    const artwork = payload?.links?.artwork || "";

    let coverArt = "";
    if (typeof artwork === "string" && artwork) {
      coverArt = new URL(artwork, upstreamUrl.origin).toString();
    }

    return res.status(200).json({
      ok: true,
      station: "Pura Gracia Radio",
      nowPlaying: {
        artist: attributes.ARTIST || "",
        title: attributes.TITLE || "",
        album: attributes.ALBUM || "",
        coverArt,
        isProduction: isProductionFile(attributes.FILENAME)
      }
    });
  } catch (error) {
    console.error("RadioBOSS metadata error:", error);
    return res.status(502).json({
      ok: false,
      error: "Unable to retrieve RadioBOSS metadata"
    });
  }
};
