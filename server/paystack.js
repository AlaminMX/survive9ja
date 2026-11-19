import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export function paymentConfig() {
  const env = process.env;
  const mode = env.PAYSTACK_MODE || "test";
  const secret = env.PAYSTACK_SECRET_KEY;
  const projectUrl =
    env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (
    (env.VERCEL_ENV === "production" && mode !== "live") ||
    !["test", "live"].includes(mode) ||
    !secret?.startsWith(`sk_${mode}_`) ||
    !projectUrl ||
    !publicKey ||
    !serviceKey
  )
    return null;
  return { mode, secret, projectUrl, publicKey, serviceKey };
}

export function supabase(config, token) {
  return createClient(
    config.projectUrl,
    token ? config.publicKey : config.serviceKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token
        ? { headers: { Authorization: "Bearer " + token } }
        : undefined,
    },
  );
}

export async function readRaw(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > 65536) throw Error("Request too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function validSignature(secret, raw, signature) {
  if (typeof signature !== "string" || !/^[0-9a-f]{128}$/i.test(signature))
    return false;
  const expected = createHmac("sha512", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export async function paystack(config, url, body) {
  const response = await fetch("https://api.paystack.co" + url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + config.secret,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(9000),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== true)
    throw Error("Paystack request failed.");
  return payload.data;
}
