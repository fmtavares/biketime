/**
 * Importa lookups da gestao a partir dos CSVs em scripts/:
 * 1) tipo_atividade
 * 2) servicos_precos
 * 3) financial_settings
 *
 * Uso: node scripts/import-lookups-csv.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/** Carrega .env simples KEY=VALUE. */
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

/**
 * Parse CSV com suporte a aspas e quebras de linha dentro do campo.
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
function parseCsv(text) {
  const rows = [];
  let headers = null;
  let fields = [];
  let cur = "";
  let inQ = false;

  const pushField = () => {
    fields.push(cur);
    cur = "";
  };
  const pushRow = () => {
    if (fields.length === 1 && fields[0] === "" && !headers) return;
    if (!headers) {
      headers = fields.map((h) => h.trim());
    } else if (fields.some((f) => f.length > 0)) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = (fields[idx] ?? "").trim();
      });
      rows.push(row);
    }
    fields = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === "," && !inQ) {
      pushField();
      continue;
    }
    if ((c === "\n" || c === "\r") && !inQ) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushField();
      pushRow();
      continue;
    }
    cur += c;
  }
  if (cur.length || fields.length) {
    pushField();
    pushRow();
  }
  return { headers: headers ?? [], rows };
}

/** Converte string vazia em null; números quando indicado. */
function emptyToNull(v) {
  if (v === undefined || v === null || v === "") return null;
  return v;
}

async function upsertTable(admin, table, rows, mapRow) {
  if (!rows.length) {
    console.log(`  ${table}: 0 linhas no CSV`);
    return;
  }
  // Limpa destino para evitar conflito de UNIQUE(nome) com seeds antigos
  const { error: delErr } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) {
    console.log(`  ${table} delete: ${delErr.message}`);
  }

  const payload = rows.map(mapRow);
  const { error } = await admin.from(table).insert(payload);
  if (error) {
    console.log(`  ${table} insert ERRO: ${error.message}`);
    return;
  }
  console.log(`  ${table}: ${payload.length} linhas importadas`);
}

async function main() {
  const env = loadEnv(resolve(root, "apps/gestao/.env"));
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em apps/gestao/.env");
  }
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) tipo_atividade
  console.log("1/3 tipo_atividade");
  const tipo = parseCsv(readFileSync(resolve(root, "scripts/tipo_atividade.csv"), "utf8"));
  await upsertTable(admin, "tipo_atividade", tipo.rows, (r) => ({
    id: r.id,
    nome: r.nome,
    created_at: emptyToNull(r.created_at) ?? undefined,
  }));

  // 2) servicos_precos
  console.log("2/3 servicos_precos");
  const precos = parseCsv(readFileSync(resolve(root, "scripts/servicos_precos.csv"), "utf8"));
  await upsertTable(admin, "servicos_precos", precos.rows, (r) => ({
    id: r.id,
    nome: r.nome,
    descricao: emptyToNull(r.descricao),
    valor: Number(r.valor),
    codigo: r.codigo,
    created_at: emptyToNull(r.created_at) ?? undefined,
    updated_at: emptyToNull(r.updated_at) ?? undefined,
  }));

  // 3) financial_settings
  console.log("3/3 financial_settings");
  const fin = parseCsv(readFileSync(resolve(root, "scripts/financial_settings.csv"), "utf8"));
  await upsertTable(admin, "financial_settings", fin.rows, (r) => ({
    id: r.id,
    icms_pct: Number(r.icms_pct),
    imposto_venda_pct: Number(r.imposto_venda_pct),
    taxa_financeira_pct: Number(r.taxa_financeira_pct),
    comissao_pct: Number(r.comissao_pct),
    markup_pct: Number(r.markup_pct),
    updated_at: emptyToNull(r.updated_at) ?? undefined,
    updated_by: emptyToNull(r.updated_by),
  }));

  console.log("\nConcluido.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
