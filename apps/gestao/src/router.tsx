import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const CHUNK_RELOAD_KEY = "biketime:chunk-reload";

/**
 * Após deploy no Vercel, abas abertas podem pedir chunks antigos (hash mudou).
 * Recarrega uma vez para pegar o HTML/assets novos e evitar loop infinito.
 */
function instalarRecargaEmFalhaDeChunk() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg = String((event.reason as Error)?.message ?? event.reason ?? "");
    if (!/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
      return;
    }
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  });

  // Limpa o flag depois que a página carregou com sucesso.
  window.setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 10_000);
}

export const getRouter = () => {
  instalarRecargaEmFalhaDeChunk();

  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
