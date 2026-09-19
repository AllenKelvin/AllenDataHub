import fs from "node:fs";
import path from "node:path";

const apiBase = process.env.VITE_API_URL || "https://allen-data-hub-backend.onrender.com";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTemplate() {
  const candidates = [
    path.join(process.cwd(), "dist", "index.html"),
    path.join(process.cwd(), "index.html"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8");
  }

  throw new Error("Frontend template not found.");
}

export default async function handler(request, response) {
  const slug = request.query?.slug;
  let storeName = "Mini Store";

  if (slug) {
    try {
      const storeResponse = await fetch(`${apiBase}/api/public/store/${encodeURIComponent(slug)}`);
      const storeData = await storeResponse.json();
      if (storeResponse.ok && storeData.store?.storeName) storeName = storeData.store.storeName;
    } catch {
      // The client app will show the request error if the store API is unavailable.
    }
  }

  const safeStoreName = escapeHtml(storeName);
  let html = getTemplate()
    .replace(/<title>[^<]*<\/title>/i, `<title>${safeStoreName}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${safeStoreName}" />`)
    .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/>/i, `<meta name="apple-mobile-web-app-title" content="${safeStoreName}" />`);

  const socialMetadata = `
      <meta property="og:title" content="${safeStoreName}" />
      <meta property="og:description" content="${safeStoreName}" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="${safeStoreName}" />
      <meta name="twitter:description" content="${safeStoreName}" />`;
  html = html.replace("</head>", `${socialMetadata}\n  </head>`);

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  response.status(200).send(html);
}
