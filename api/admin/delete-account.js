import { createClient } from "@supabase/supabase-js";
import { readRaw } from "../../server/paystack.js";

export const config = { api: { bodyParser: false } };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  const token = request.headers.authorization?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if (!token) return response.status(401).json({ error: "Sign in as an administrator." });
  const env = process.env;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !publicKey || !serviceKey)
    return response.status(503).json({ error: "Account deletion requires the server’s Supabase configuration." });
  let target, note, confirmation;
  try {
    ({ target, note, confirmation } = JSON.parse(await readRaw(request)));
  } catch {
    return response.status(400).json({ error: "Invalid deletion request." });
  }
  if (confirmation !== "DELETE" || typeof target !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(target) ||
      typeof note !== "string" || note.trim().length < 3 || note.trim().length > 500)
    return response.status(400).json({ error: "Choose an account and enter a deletion reason." });

  try {
    const auth = { persistSession: false, autoRefreshToken: false };
    const client = createClient(url, publicKey, { auth, global: { headers: { Authorization: "Bearer " + token } } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return response.status(401).json({ error: "Sign in as an administrator." });

    const args = { p_target: target, p_note: note.trim() };
    const { error: rejected } = await client.rpc("admin_check_account_deletion", args);
    if (rejected) return response.status(rejected.code === "42501" ? 403 : 409).json({ error: rejected.message });

    const storage = createClient(url, serviceKey, { auth }).storage;
    for (const name of ["survive9ja-avatars", "gist-voice-notes"]) {
      const bucket = storage.from(name);
      let complete = false;
      for (let batch = 0; batch < 10; batch += 1) {
        const { data: objects, error: listError } = await bucket.list(target, { limit: 100 });
        if (listError) throw listError;
        if (!objects.length) {
          complete = true;
          break;
        }
        if (objects.some((object) => !object.id)) throw Error("Unexpected media folder.");
        const { error: removeError } = await bucket.remove(objects.map((object) => target + "/" + object.name));
        if (removeError) throw removeError;
      }
      if (!complete)
        return response.status(409).json({ error: "Some uploaded media remains. Retry to finish cleanup." });
    }
    const { error: deleteError } = await client.rpc("admin_delete_account", args);
    if (deleteError)
      return response.status(deleteError.code === "42501" ? 403 : 409).json({ error: deleteError.message });
    return response.status(200).json({ deleted: true });

  } catch {
    return response.status(502).json({ error: "Account deletion could not finish. Retry to complete any remaining cleanup." });
  }
}
