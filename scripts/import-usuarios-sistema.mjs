/**
 * Importa usuarios sistemicos do CSV para o Supabase destino,
 * preservando os UUIDs originais (necessario para FKs na migracao de dados).
 *
 * Uso: node scripts/import-usuarios-sistema.mjs
 * Requer apps/gestao/.env com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/** Carrega pares KEY=VALUE de um arquivo .env simples. */
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

/** Parse CSV simples com aspas (roles podem ter virgula). */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

const TEMP_PASSWORD = "Biketime2026!";

async function main() {
  const env = loadEnv(resolve(root, "apps/gestao/.env"));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em apps/gestao/.env");
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = parseCsv(
    readFileSync(resolve(root, "scripts/usuarios_sistema.csv"), "utf8"),
  );

  console.log(`Importando ${rows.length} usuarios (senha temporaria: ${TEMP_PASSWORD})\n`);

  for (const row of rows) {
    const id = row.id;
    const email = row.email;
    const full_name = row.full_name;
    const roles = row.roles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    process.stdout.write(`→ ${email} (${id.slice(0, 8)}…) roles=[${roles.join(", ")}] `);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      id,
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr) {
      // Ja existe: tenta atualizar metadata / senha
      if (
        /already|exists|registered/i.test(createErr.message) ||
        createErr.status === 422
      ) {
        const { error: updErr } = await admin.auth.admin.updateUserById(id, {
          email,
          password: TEMP_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name },
        });
        if (updErr) {
          console.log(`ERRO update: ${updErr.message}`);
          continue;
        }
        console.log("ja existia → atualizado;");
      } else {
        console.log(`ERRO create: ${createErr.message}`);
        continue;
      }
    } else {
      console.log(`criado (${created.user?.id === id ? "uuid ok" : "uuid diff"});`);
    }

    const { error: profErr } = await admin.from("profiles").upsert({
      id,
      email,
      full_name,
    });
    if (profErr) console.log(`  profile: ${profErr.message}`);

    // Remove roles antigas deste user e grava as do CSV
    const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", id);
    if (delErr) console.log(`  roles delete: ${delErr.message}`);

    for (const role of roles) {
      const { error: roleErr } = await admin.from("user_roles").insert({
        user_id: id,
        role,
      });
      if (roleErr) console.log(`  role ${role}: ${roleErr.message}`);
    }
  }

  console.log("\nConcluido. Pedir troca de senha no primeiro acesso.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
