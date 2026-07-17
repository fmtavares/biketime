import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/vendas")({
  component: VendasLayout,
});

function VendasLayout() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <Outlet />
    </div>
  );
}
