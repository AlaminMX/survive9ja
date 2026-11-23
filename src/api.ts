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
  const { error, data, status } = await db.rpc(name, args);
  if (error)
    throw Error(
      error.code === "23505"
        ? "That username is already taken."
        : message({ message: error.message, code: error.code, status }),
    );
  return data as T;
}
export const connectionMessage = "Poor internet connection. Check your connection and try again.";

export function message(error: unknown, fallback = "Something went wrong. Please try again.") {
  const details = error && typeof error === "object" ? error as {
    message?: unknown; name?: unknown; status?: unknown; code?: unknown;
  } : {};
  const text = typeof details.message === "string" ? details.message.trim() : typeof error === "string" ? error.trim() : "";
  const status = Number(details.status);
  if (
    details.status === 0 || details.name === "FunctionsFetchError" ||
    (details.name === "AuthRetryableFetchError" && !status) ||
    /failed to fetch|load failed|network\s*error|network request failed|fetch failed|internet connection.*offline|err_(?:internet|network|connection|timed_out)|econnreset|etimedout/i.test(text)
  ) return connectionMessage;
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500 || details.name === "FunctionsRelayError" || details.code === "PGRST202")
    return "Survive9ja is temporarily unavailable. Please try again in a moment.";
  if (/^permission denied (?:for|to) /i.test(text)) return "You don’t have access to do that.";
  return text || fallback;
}
