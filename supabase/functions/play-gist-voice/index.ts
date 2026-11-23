const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Voice-Content-Type",
  "Cache-Control": "private, no-store",
};
const pathPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response(null, { status: 405, headers });

  let path: unknown;
  try {
    const input = await request.text();
    if (input.length > 256) return new Response(null, { status: 400, headers });
    path = JSON.parse(input)?.path;
  } catch {
    return new Response(null, { status: 400, headers });
  }
  if (typeof path !== "string" || !pathPattern.test(path))
    return new Response(null, { status: 400, headers });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return new Response(null, { status: 503, headers });
  const supplied = request.headers.get("Authorization");
  // Publishable API keys are not user sessions. Use the project’s anon JWT
  // for public reads and leave authenticated tokens to PostgREST to validate.
  const caller = supplied && !supplied.toLowerCase().startsWith("bearer sb_publishable_")
    ? supplied : "Bearer " + anon;
  try {
    const allowed = await fetch(url + "/rest/v1/rpc/gist_voice_object_allowed", {
      method: "POST",
      headers: { apikey: anon, Authorization: caller, "Content-Type": "application/json" },
      body: JSON.stringify({ p_path: path, p_operation: "read" }),
    });
    if (!allowed.ok || await allowed.json() !== true)
      return new Response(null, { status: 404, headers });

    const audio = await fetch(url + "/storage/v1/object/authenticated/gist-voice-notes/" + path, {
      headers: { apikey: service, Authorization: "Bearer " + service },
    });
    if (!audio.ok || !audio.body) return new Response(null, { status: 404, headers });
    return new Response(audio.body, {
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
        "X-Voice-Content-Type": audio.headers.get("Content-Type") ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 502, headers });
  }
});
