import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/vendas/estoque")({
  component: RedirecionaEstoqueParaProdutos,
});

/**
 * A lista de bikes saiu do menu e passou a viver em Produtos, filtro Bikes.
 * A URL antiga continua válida para links internos.
 */
function RedirecionaEstoqueParaProdutos() {
  return <Navigate to="/vendas/produtos" search={{ categoria: "Bikes" }} replace />;
}
