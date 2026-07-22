/**
 * Importa dados principais da gestao (ordem FK):
 * clientes → bikes → bike_fotos → historicos → ordens_servico
 *
 * Uso: node scripts/import-core-csv.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/** Carrega .env KEY=VALUE. */
function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** Lê CSV via Python (utf-8-sig + campos multilinha). */
function readCsv(path) {
  const py = `
import csv, json, sys
from pathlib import Path
p = Path(sys.argv[1])
with p.open(encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
print(json.dumps(rows, ensure_ascii=False))
`;
  const r = spawnSync("python3", ["-c", py, path], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`CSV parse failed ${path}: ${r.stderr}`);
  }
  return JSON.parse(r.stdout);
}

function emptyToNull(v) {
  if (v === undefined || v === null || v === "") return null;
  return v;
}

function parseBool(v, def = false) {
  if (v === undefined || v === null || v === "") return def;
  const s = String(v).toLowerCase();
  if (s === "t" || s === "true" || s === "1" || s === "yes") return true;
  if (s === "f" || s === "false" || s === "0" || s === "no") return false;
  return def;
}

/** Converte literal Postgres array {a,b} ou {} em string[]. */
function parsePgArray(v) {
  if (v === undefined || v === null || v === "") return [];
  const s = String(v).trim();
  if (s === "{}" || s === "") return [];
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      return JSON.parse(s);
    } catch {
      /* fallthrough */
    }
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1);
    if (!inner) return [];
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }
  return [s];
}

function parseNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function clearTable(admin, table) {
  const { error } = await admin
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`${table} clear: ${error.message}`);
}

async function insertChunks(admin, table, rows, chunkSize = 100) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from(table).insert(chunk);
    if (error) {
      throw new Error(`${table} insert @${i}: ${error.message}`);
    }
  }
  console.log(`  ${table}: ${rows.length} linhas`);
}

async function main() {
  const env = loadEnv(resolve(root, "apps/gestao/.env"));
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ordem inversa para limpar FKs
  console.log("Limpando tabelas destino…");
  for (const t of [
    "ordens_servico",
    "historicos",
    "bike_fotos",
    "bikes",
    "clientes",
  ]) {
    await clearTable(admin, t);
  }

  // 1) clientes
  console.log("1/5 clientes");
  const clientes = readCsv(resolve(root, "scripts/clientes.csv")).map((r) => ({
    id: r.id,
    nome: r.nome,
    whatsapp: emptyToNull(r.whatsapp),
    telefone_secundario: emptyToNull(r.telefone_secundario),
    email: emptyToNull(r.email),
    cpf: emptyToNull(r.cpf),
    endereco: emptyToNull(r.endereco),
    cidade: emptyToNull(r.cidade),
    estado: emptyToNull(r.estado),
    data_nascimento: emptyToNull(r.data_nascimento),
    instagram: emptyToNull(r.instagram),
    vendedor_responsavel: emptyToNull(r.vendedor_responsavel),
    vip: parseBool(r.vip, false),
    observacoes: emptyToNull(r.observacoes),
    origem_lead: emptyToNull(r.origem_lead),
    modalidades: parsePgArray(r.modalidades),
    nivel: emptyToNull(r.nivel),
    frequencia: emptyToNull(r.frequencia),
    objetivo: emptyToNull(r.objetivo),
    participa_provas: parseBool(r.participa_provas, false),
    equipe: emptyToNull(r.equipe),
    tamanho_bike: emptyToNull(r.tamanho_bike),
    altura: emptyToNull(r.altura),
    marca_preferida: emptyToNull(r.marca_preferida),
    sonho_consumo: emptyToNull(r.sonho_consumo),
    created_by: emptyToNull(r.created_by),
    created_at: emptyToNull(r.created_at) ?? undefined,
    updated_at: emptyToNull(r.updated_at) ?? undefined,
    cep: emptyToNull(r.cep),
    bairro: emptyToNull(r.bairro),
    numero: emptyToNull(r.numero),
    apto: emptyToNull(r.apto),
  }));
  await insertChunks(admin, "clientes", clientes);

  // 2) bikes
  console.log("2/5 bikes");
  const bikes = readCsv(resolve(root, "scripts/bikes.csv")).map((r) => ({
    id: r.id,
    cliente_id: r.cliente_id,
    marca: r.marca,
    modelo: r.modelo,
    ano: parseIntOrNull(r.ano),
    cor: emptyToNull(r.cor),
    tamanho: emptyToNull(r.tamanho),
    numero_serie: emptyToNull(r.numero_serie),
    data_compra: emptyToNull(r.data_compra),
    valor_pago: parseNum(r.valor_pago),
    onde_comprou: emptyToNull(r.onde_comprou),
    bike_atual: parseBool(r.bike_atual, true),
    status: emptyToNull(r.status) ?? "atual",
    observacoes: emptyToNull(r.observacoes),
    created_at: emptyToNull(r.created_at) ?? undefined,
    updated_at: emptyToNull(r.updated_at) ?? undefined,
    tipo: emptyToNull(r.tipo),
    grupo: emptyToNull(r.grupo),
    rodas: emptyToNull(r.rodas),
  }));
  await insertChunks(admin, "bikes", bikes);

  // 3) bike_fotos
  console.log("3/5 bike_fotos");
  const fotos = readCsv(resolve(root, "scripts/bike_fotos.csv")).map((r) => ({
    id: r.id,
    bike_id: r.bike_id,
    tipo: r.tipo,
    storage_path: r.storage_path,
    created_at: emptyToNull(r.created_at) ?? undefined,
  }));
  await insertChunks(admin, "bike_fotos", fotos);

  // 4) historicos (pode estar vazio)
  console.log("4/5 historicos");
  const historicos = readCsv(resolve(root, "scripts/historicos.csv")).map((r) => ({
    id: r.id,
    bike_id: r.bike_id,
    data: emptyToNull(r.data) ?? undefined,
    numero_os: emptyToNull(r.numero_os),
    tipo: r.tipo,
    descricao: r.descricao,
    km_horimetro: emptyToNull(r.km_horimetro),
    valor: parseNum(r.valor),
    observacoes: emptyToNull(r.observacoes),
    created_at: emptyToNull(r.created_at) ?? undefined,
  }));
  if (historicos.length) await insertChunks(admin, "historicos", historicos);
  else console.log("  historicos: 0 linhas (CSV vazio)");

  // 5) ordens_servico
  console.log("5/5 ordens_servico");
  const os = readCsv(resolve(root, "scripts/ordens_servico.csv")).map((r) => ({
    id: r.id,
    numero: r.numero,
    cliente_id: r.cliente_id,
    bike_id: r.bike_id,
    problema_relatado: emptyToNull(r.problema_relatado),
    checklist_entrada: emptyToNull(r.checklist_entrada),
    mecanico: emptyToNull(r.mecanico),
    data_entrada: emptyToNull(r.data_entrada) ?? undefined,
    data_prevista: emptyToNull(r.data_prevista),
    servicos_executados: emptyToNull(r.servicos_executados),
    pecas_utilizadas: emptyToNull(r.pecas_utilizadas),
    valor_pecas: parseNum(r.valor_pecas) ?? 0,
    valor_mao_obra: parseNum(r.valor_mao_obra) ?? 0,
    observacoes_tecnicas: emptyToNull(r.observacoes_tecnicas),
    fotos_servico: parsePgArray(r.fotos_servico),
    aprovado: r.aprovado === "" || r.aprovado == null ? null : parseBool(r.aprovado),
    data_aprovacao: emptyToNull(r.data_aprovacao),
    valor_aprovado: parseNum(r.valor_aprovado),
    data_conclusao: emptyToNull(r.data_conclusao),
    data_entrega: emptyToNull(r.data_entrega),
    observacao_conclusao: emptyToNull(r.observacao_conclusao),
    proxima_revisao: emptyToNull(r.proxima_revisao),
    status: emptyToNull(r.status) ?? "fila",
    created_by: emptyToNull(r.created_by),
    created_at: emptyToNull(r.created_at) ?? undefined,
    updated_at: emptyToNull(r.updated_at) ?? undefined,
    aprovado_por: emptyToNull(r.aprovado_por),
    pago_por: emptyToNull(r.pago_por),
    forma_pagamento: emptyToNull(r.forma_pagamento),
    data_pagamento: emptyToNull(r.data_pagamento),
    responsavel_entrega: emptyToNull(r.responsavel_entrega),
    responsavel_recebimento: emptyToNull(r.responsavel_recebimento),
    responsavel_avaliacao: emptyToNull(r.responsavel_avaliacao),
    data_avaliacao: emptyToNull(r.data_avaliacao),
    observacoes_execucao: emptyToNull(r.observacoes_execucao),
    quem_puxou: emptyToNull(r.quem_puxou),
    responsavel_execucao: emptyToNull(r.responsavel_execucao),
  }));
  await insertChunks(admin, "ordens_servico", os);

  // Ajusta sequence da OS para nao colidir com numeros importados
  const maxOs = os.reduce((m, row) => {
    const n = parseInt(String(row.numero).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  console.log(`\nSequence tip: proximo OS deve ser > ${maxOs} (ajuste manual no SQL se necessario)`);
  console.log("Concluido.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
