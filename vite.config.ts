import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

function isPublicKey(key: string | undefined) {
  if (!key || key.startsWith("sb_secret_")) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    ) as { role?: string };
    return payload.role === "anon";
  } catch {
    return key.startsWith("sb_publishable_");
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), [
    "VITE_SUPABASE_",
    "NEXT_PUBLIC_SUPABASE_",
    "SUPABASE_",
  ]);
  const configs = [
    [
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ],
    [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ],
    [
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY ||
        env.SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        env.SUPABASE_ANON_KEY,
    ],
  ];
  const [url, key] =
    configs.find(([url, key]) => url?.trim() && isPublicKey(key?.trim())) ?? [];

  return {
    plugins: [react(), tailwind()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url?.trim() ?? ""),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        key?.trim() ?? "",
      ),
    },
  };
});
