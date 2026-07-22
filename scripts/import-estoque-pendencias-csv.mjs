/**
 * Importa tabelas restantes da gestao (ordem FK):
 * bikes_estoque → bike_estoque_observations → produtos → pendencias → pendencia_votos
 *
 * Uso: node scripts/import-estoque-pendencias-csv.mjs
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

/** Limpa tabela com coluna id uuid. */
async function clearById(admin, table) {
  const { error } = await admin
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`${table} clear: ${error.message}`);
}

/** Limpa pendencia_votos (PK composta, sem coluna id). */
async function clearPendenciaVotos(admin) {
  const { error } = await admin
    .from("pendencia_votos")
    .delete()
    .neq("pendencia_id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`pendencia_votos clear: ${error.message}`);
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
  await clearPendenciaVotos(admin);
  await clearById(admin, "pendencias");
  await clearById(admin, "produtos");
  await clearById(admin, "bike_estoque_observations");
  await clearById(admin, "bikes_estoque");

  // 1) bikes_estoque
  console.log("1/5 bikes_estoque");
  const bikesEstoque = readCsv(resolve(root, "scripts/bikes_estoque.csv")).map(
    (r) => ({
      id: r.id,
      sku: emptyToNull(r.sku),
      numero_serie: emptyToNull(r.numero_serie),
      status: emptyToNull(r.status) ?? "em_estoque",
      data_entrada: emptyToNull(r.data_entrada) ?? undefined,
      fornecedor: emptyToNull(r.fornecedor),
      marca: r.marca,
      modelo: r.modelo,
      ano: parseIntOrNull(r.ano),
      categoria: emptyToNull(r.categoria),
      tamanho: emptyToNull(r.tamanho),
      material_quadro: emptyToNull(r.material_quadro),
      peso: parseNum(r.peso),
      cor: emptyToNull(r.cor),
      grupo: emptyToNull(r.grupo),
      modelo_grupo: emptyToNull(r.modelo_grupo),
      relacao: emptyToNull(r.relacao),
      freios: emptyToNull(r.freios),
      rodas: emptyToNull(r.rodas),
      suspensao: emptyToNull(r.suspensao),
      guidao: emptyToNull(r.guidao),
      canote: emptyToNull(r.canote),
      pedivela: emptyToNull(r.pedivela),
      pneus: emptyToNull(r.pneus),
      medidor_potencia: emptyToNull(r.medidor_potencia),
      acessorios: emptyToNull(r.acessorios),
      condicao: emptyToNull(r.condicao),
      quilometragem: parseNum(r.quilometragem),
      historico_manutencao: emptyToNull(r.historico_manutencao),
      garantia: emptyToNull(r.garantia),
      observacoes_tecnicas: emptyToNull(r.observacoes_tecnicas),
      custo_bike: parseNum(r.custo_bike) ?? 0,
      frete: parseNum(r.frete) ?? 0,
      seguro: parseNum(r.seguro) ?? 0,
      montagem: parseNum(r.montagem) ?? 0,
      revisao_inicial: parseNum(r.revisao_inicial) ?? 0,
      custos_adicionais: parseNum(r.custos_adicionais) ?? 0,
      valor_minimo: parseNum(r.valor_minimo),
      foto_completa: emptyToNull(r.foto_completa),
      foto_cambio_frente: emptyToNull(r.foto_cambio_frente),
      foto_cambio_traseiro: emptyToNull(r.foto_cambio_traseiro),
      foto_freio: emptyToNull(r.foto_freio),
      foto_numero_serie: emptyToNull(r.foto_numero_serie),
      fotos: parsePgArray(r.fotos),
      created_at: emptyToNull(r.created_at) ?? undefined,
      updated_at: emptyToNull(r.updated_at) ?? undefined,
      created_by: emptyToNull(r.created_by),
      visivel_ecommerce: parseBool(r.visivel_ecommerce, false),
      valor_mercado: parseNum(r.valor_mercado),
      override_icms_pct: parseNum(r.override_icms_pct),
      override_imposto_venda_pct: parseNum(r.override_imposto_venda_pct),
      override_taxa_financeira_pct: parseNum(r.override_taxa_financeira_pct),
      override_comissao_pct: parseNum(r.override_comissao_pct),
      override_markup_pct: parseNum(r.override_markup_pct),
      valor_proposto: parseNum(r.valor_proposto),
    }),
  );
  await insertChunks(admin, "bikes_estoque", bikesEstoque);

  // 2) bike_estoque_observations
  console.log("2/5 bike_estoque_observations");
  const obs = readCsv(
    resolve(root, "scripts/bike_estoque_observations.csv"),
  ).map((r) => ({
    id: r.id,
    bike_estoque_id: r.bike_estoque_id,
    user_id: r.user_id,
    texto: r.texto,
    created_at: emptyToNull(r.created_at) ?? undefined,
    updated_at: emptyToNull(r.updated_at) ?? undefined,
  }));
  await insertChunks(admin, "bike_estoque_observations", obs);

  // 3) produtos (CSV pode estar vazio)
  console.log("3/5 produtos");
  const produtos = readCsv(resolve(root, "scripts/produtos.csv")).map((r) => ({
    id: r.id,
    sku: emptyToNull(r.sku),
    codigo_barras: emptyToNull(r.codigo_barras),
    nome: r.nome,
    descricao: emptyToNull(r.descricao),
    categoria: emptyToNull(r.categoria),
    marca: emptyToNull(r.marca),
    modelo: emptyToNull(r.modelo),
    unidade: emptyToNull(r.unidade) ?? "UN",
    custo: parseNum(r.custo) ?? 0,
    preco_venda: parseNum(r.preco_venda) ?? 0,
    valor_minimo: parseNum(r.valor_minimo),
    estoque_atual: parseNum(r.estoque_atual) ?? 0,
    estoque_minimo: parseNum(r.estoque_minimo) ?? 0,
    fornecedor: emptyToNull(r.fornecedor),
    fotos: parsePgArray(r.fotos),
    observacoes: emptyToNull(r.observacoes),
    ativo: parseBool(r.ativo, true),
    visivel_ecommerce: parseBool(r.visivel_ecommerce, false),
    created_by: emptyToNull(r.created_by),
    created_at: emptyToNull(r.created_at) ?? undefined,
    updated_at: emptyToNull(r.updated_at) ?? undefined,
  }));
  if (produtos.length) await insertChunks(admin, "produtos", produtos);
  else console.log("  produtos: 0 linhas (CSV vazio)");

  // 4) pendencias
  console.log("4/5 pendencias");
  const pendencias = readCsv(resolve(root, "scripts/pendencias.csv")).map(
    (r) => ({
      id: r.id,
      atividade: r.atividade,
      tipo_atividade: emptyToNull(r.tipo_atividade),
      data_prevista: emptyToNull(r.data_prevista),
      responsavel_id: emptyToNull(r.responsavel_id),
      privado: parseBool(r.privado, false),
      concluida: parseBool(r.concluida, false),
      created_by: r.created_by,
      created_at: emptyToNull(r.created_at) ?? undefined,
      updated_at: emptyToNull(r.updated_at) ?? undefined,
    }),
  );
  await insertChunks(admin, "pendencias", pendencias);

  // 5) pendencia_votos
  console.log("5/5 pendencia_votos");
  const votos = readCsv(resolve(root, "scripts/pendencia_votos.csv")).map(
    (r) => ({
      pendencia_id: r.pendencia_id,
      user_id: r.user_id,
      coins: parseIntOrNull(r.coins),
      created_at: emptyToNull(r.created_at) ?? undefined,
      updated_at: emptyToNull(r.updated_at) ?? undefined,
    }),
  );
  await insertChunks(admin, "pendencia_votos", votos);

  console.log("Concluido.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
