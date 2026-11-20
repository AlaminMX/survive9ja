export const profilePath = "/profile";

export function profileReturn(state: unknown): string | undefined {
  if (!state || typeof state !== "object" || !("fromProfile" in state)) return;
  const path = state.fromProfile;
  if (typeof path === "string" && (path === profilePath || /^\/u\/[a-z0-9_]{3,20}$/.test(path))) return path;
}
