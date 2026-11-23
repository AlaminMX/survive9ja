import { shareDetails } from "../src/share-details.js";

const site = "https://survive9ja.vercel.app";
const image = site + "/survive9ja-social.jpg";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function isPublicKey(key) {
  if (key?.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET" && request.method !== "HEAD")
    return response.status(405).end();

  const { kind, id } = request.query;
  if (!["post", "diary"].includes(kind) || typeof id !== "string" || !uuid.test(id))
    return response.status(404).end();

  const destination = "/" + kind + "/" + id.toLowerCase();
  const shareUrl = site + "/share" + destination;
  const env = process.env;
  const supabase = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_DEFAULT_KEY || env.SUPABASE_ANON_KEY;
  let preview = { title: "Survive9ja", description: "Stories and conversations about life in Nigeria." };
  if (supabase && isPublicKey(key)) {
    try {
      const result = await fetch(new URL("/rest/v1/rpc/read_thread", supabase), {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ p_id: id, p_kind: kind === "post" ? "square" : "diary" }),
        signal: AbortSignal.timeout(2500),
      });
      const thread = result.ok ? await result.json() : null;
      if (thread?.entry) preview = shareDetails(thread.entry);
    } catch {
      // Keep the discussion link usable if the preview lookup is unavailable.
    }
  }

  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method === "HEAD") return response.status(200).end();
  return response.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Survive9ja">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${shareUrl}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Gist beside a yellow danfo bus and the Lagos skyline">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body>
<h1>${title}</h1>
<a href="${destination}">Open on Survive9ja</a>
<script>if (location.pathname.startsWith("/share/") || location.pathname.startsWith("/api/")) location.replace(${JSON.stringify(destination)});</script>
</body>
</html>`);
}
