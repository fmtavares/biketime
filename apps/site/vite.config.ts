// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

/** Build na Vercel não usa o runtime Cloudflare Workers. */
const isVercel = process.env.VERCEL === "1";

/**
 * Configura o Vite/TanStack Start.
 * - Local: mantém target Cloudflare (plugin Lovable).
 * - Vercel: desliga Cloudflare e usa Nitro com preset vercel (entryFormat node).
 */
export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: isVercel ? [nitro({ preset: "vercel", vercel: { entryFormat: "node" } })] : [],
});
