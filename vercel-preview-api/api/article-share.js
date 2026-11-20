const SUPABASE_URL = "https://kcrehxxnsfszfcikofsw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Osi7AyLU3svYgUomDTEfpw_h52xCrgr";
const PWA_URL = "https://arios71.github.io/puragracia-radio-preview/";
const DEFAULT_IMAGE = "https://arios71.github.io/puragracia-radio-preview/assets/branding/logo-horizontal.webp";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function absoluteUrl(value) {
  try { return new URL(value, PWA_URL).toString(); }
  catch (_) { return DEFAULT_IMAGE; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const articleKey = String(req.query.article || "").trim();
  if (!articleKey || articleKey.length > 200) {
    return res.status(400).send("Falta el identificador del artículo.");
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(articleKey);
    const filter = isUuid ? "id" : "slug";
    const query = new URLSearchParams({
      select: "id,slug,title,author,excerpt,cover_image_url,article_date",
      status: "eq.published",
      [filter]: "eq." + articleKey,
      limit: "1"
    });

    const response = await fetch(SUPABASE_URL + "/rest/v1/articles?" + query.toString(), {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error("Supabase respondió " + response.status);
    const rows = await response.json();
    const article = rows && rows[0];

    if (!article) {
      return res.status(404).send("Este artículo no está disponible.");
    }

    const title = article.title || "Artículo de Pura Gracia Radio";
    const description = article.excerpt || "Lee este artículo de Pura Gracia Radio: música y contenido en sintonía con el evangelio de Cristo.";
    const image = absoluteUrl(article.cover_image_url || DEFAULT_IMAGE);
    const canonical = PWA_URL + "?articulo=" + encodeURIComponent(article.slug || article.id) + "#articulos";
    const shareUrl = "https://puragracia-radio-preview-vercel-pre.vercel.app/api/article-share?article=" + encodeURIComponent(article.slug || article.id);

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} | Pura Gracia Radio</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Pura Gracia Radio">
<meta property="og:locale" content="es_PR">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(title)}">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">

</head>
<body>
<p>Abriendo el artículo en Pura Gracia Radio…</p>
<p><a href="${escapeHtml(canonical)}">Continuar leyendo: ${escapeHtml(title)}</a></p>
<script>window.location.replace(${JSON.stringify(canonical)});</script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Article share preview error:", error);
    return res.status(502).send("No fue posible preparar la vista previa del artículo.");
  }
};
