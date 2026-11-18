import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Capture the email callback before Supabase consumes its URL fragment.
const callbackHash = new URLSearchParams(window.location.hash.slice(1));
const callbackSearch = new URLSearchParams(window.location.search);
export const authCallback = {
  type: callbackHash.get("type"),
  failed: callbackHash.has("error") || callbackSearch.has("error"),
};

export const db = url && key ? createClient(url, key) : null;
export const preview = !db && import.meta.env.DEV;
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!db)
    throw Error("Account and community features need a Supabase connection.");
  const { error, data } = await db.rpc(name, args);
  if (error)
    throw Error(
      error.code === "23505"
        ? "That username is already taken."
        : error.message,
    );
  return data as T;
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
