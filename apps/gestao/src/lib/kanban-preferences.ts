/**
 * Preferências de colunas visíveis do Kanban da oficina.
 * Persiste no localStorage e aplica presets iniciais por perfil.
 */

export type KanbanColumnId =
  | "fila"
  | "avaliacao"
  | "aguardando_aprovacao"
  | "em_execucao"
  | "com_problemas"
  | "finalizada"
  | "entregue"
  | "pago";

export type KanbanColumn = {
  id: KanbanColumnId;
  label: string;
  grupo: string;
};

export const COLUNAS: KanbanColumn[] = [
  { id: "fila", label: "Fila de Entrada", grupo: "Recepção" },
  { id: "avaliacao", label: "Avaliação", grupo: "Recepção" },
  { id: "aguardando_aprovacao", label: "Aguardando aprovação", grupo: "Recepção" },
  { id: "em_execucao", label: "Em execução", grupo: "Execução" },
  { id: "com_problemas", label: "Com problemas", grupo: "Execução" },
  { id: "finalizada", label: "Finalizada", grupo: "Execução" },
  { id: "entregue", label: "Entregue", grupo: "Entrega & Pagamento" },
  { id: "pago", label: "Pago", grupo: "Entrega & Pagamento" },
];

export const ALL_COLUMN_IDS: KanbanColumnId[] = COLUNAS.map((c) => c.id);

/** Grupos usados só na UI do filtro (checkboxes organizados). */
export const GRUPOS_FILTRO = [
  "Recepção",
  "Execução",
  "Entrega & Pagamento",
] as const;

const LS_KEY = "bt-gestao-kanban-columns";

type Role = string;

/**
 * Presets iniciais por perfil quando ainda não há preferência salva.
 */
const HIDDEN_BY_ROLE: Record<string, KanbanColumnId[]> = {
  tecnico: ["entregue", "pago"],
  vendedor: ["em_execucao", "com_problemas"],
};

/**
 * Resolve o preset padrão de colunas visíveis a partir dos roles do usuário.
 * Prioridade: admin > tecnico > vendedor > todas.
 */
export function getDefaultVisible(roles: Role[]): KanbanColumnId[] {
  if (roles.includes("admin")) return [...ALL_COLUMN_IDS];
  if (roles.includes("tecnico")) {
    const hidden = new Set(HIDDEN_BY_ROLE.tecnico);
    return ALL_COLUMN_IDS.filter((id) => !hidden.has(id));
  }
  if (roles.includes("vendedor")) {
    const hidden = new Set(HIDDEN_BY_ROLE.vendedor);
    return ALL_COLUMN_IDS.filter((id) => !hidden.has(id));
  }
  return [...ALL_COLUMN_IDS];
}

/**
 * Valida e normaliza uma lista de ids de coluna.
 */
function sanitize(ids: unknown): KanbanColumnId[] | null {
  if (!Array.isArray(ids)) return null;
  const valid = new Set<string>(ALL_COLUMN_IDS);
  const filtered = ids.filter((id): id is KanbanColumnId => typeof id === "string" && valid.has(id));
  if (filtered.length === 0) return null;
  // Mantém a ordem canônica de COLUNAS
  return ALL_COLUMN_IDS.filter((id) => filtered.includes(id));
}

/**
 * Lê colunas visíveis do localStorage; se vazio, usa preset do perfil.
 */
export function loadVisibleColumns(roles: Role[]): KanbanColumnId[] {
  if (typeof window === "undefined") return getDefaultVisible(roles);
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return getDefaultVisible(roles);
    return sanitize(JSON.parse(raw)) ?? getDefaultVisible(roles);
  } catch {
    return getDefaultVisible(roles);
  }
}

/**
 * Persiste a lista de colunas visíveis no localStorage.
 */
export function saveVisibleColumns(ids: KanbanColumnId[]): void {
  if (typeof window === "undefined") return;
  const clean = sanitize(ids);
  if (!clean) return;
  localStorage.setItem(LS_KEY, JSON.stringify(clean));
}
