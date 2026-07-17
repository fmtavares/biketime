import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gestão de Clientes" },
      {
        name: "description",
        content: "CRM + Oficina para bike shop: clientes, bikes, OS e Kanban.",
      },
      { property: "og:title", content: "Gestão de Clientes" },
      { name: "twitter:title", content: "Gestão de Clientes" },
      { name: "description", content: "A web application for bike shops to manage customers, bikes, and workshop operations." },
      { property: "og:description", content: "A web application for bike shops to manage customers, bikes, and workshop operations." },
      { name: "twitter:description", content: "A web application for bike shops to manage customers, bikes, and workshop operations." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/JxkYX3EOVdRexFMAK7rd0es7B9d2/social-images/social-1778462899342-IMG_8417.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/JxkYX3EOVdRexFMAK7rd0es7B9d2/social-images/social-1778462899342-IMG_8417.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
