import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

const isVercel = process.env.VERCEL === "1";

/** Config Vite/TanStack Start da gestao (Nitro na Vercel). */
export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: isVercel ? [nitro({ preset: "vercel", vercel: { entryFormat: "node" } })] : [],
});
