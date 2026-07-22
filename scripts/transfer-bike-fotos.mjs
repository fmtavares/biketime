/**
 * Transfere arquivos do bucket publico bike-fotos (Lovable) para o Site Bike Time,
 * mantendo os mesmos storage_path.
 *
 * Uso: node scripts/transfer-bike-fotos.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const BUCKET = "bike-fotos";

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

function readCsvPaths(csvPath) {
  const py = `
import csv, json, sys
from pathlib import Path
rows = list(csv.DictReader(Path(sys.argv[1]).open(encoding="utf-8-sig")))
print(json.dumps([r["storage_path"] for r in rows if r.get("storage_path")]))
`;
  const r = spawnSync("python3", ["-c", py, csvPath], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

function guessContentType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

async function main() {
  const srcEnv = loadEnv("/Users/serasa/Documents/projetos/gestaobiketime/.env");
  const dstEnv = loadEnv(resolve(root, "apps/gestao/.env"));
  const srcUrl = srcEnv.SUPABASE_URL || srcEnv.VITE_SUPABASE_URL;
  if (!srcUrl) throw new Error("URL do Lovable nao encontrada em gestaobiketime/.env");
  if (!dstEnv.SUPABASE_URL || !dstEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Destino sem SUPABASE_URL / SERVICE_ROLE_KEY");
  }

  const dst = createClient(dstEnv.SUPABASE_URL, dstEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const paths = [...new Set(readCsvPaths(resolve(root, "scripts/bike_fotos.csv")))];
  console.log(`Transferindo ${paths.length} arquivos ${srcUrl} → ${dstEnv.SUPABASE_URL}\n`);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const label = `[${i + 1}/${paths.length}] ${path}`;

    // Ja existe no destino?
    const { data: existing } = await dst.storage.from(BUCKET).list(path.split("/").slice(0, -1).join("/"), {
      search: path.split("/").pop(),
      limit: 5,
    });
    const fileName = path.split("/").pop();
    if (existing?.some((f) => f.name === fileName && (f.metadata?.size ?? 0) > 0)) {
      console.log(`${label} — ja existe, skip`);
      skip++;
      continue;
    }

    const pub = `${srcUrl}/storage/v1/object/public/${BUCKET}/${path}`;
    let res;
    try {
      res = await fetch(pub);
    } catch (e) {
      console.log(`${label} — download erro: ${e.message}`);
      fail++;
      failures.push(path);
      continue;
    }
    if (!res.ok) {
      console.log(`${label} — download HTTP ${res.status}`);
      fail++;
      failures.push(path);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || guessContentType(path);
    const { error } = await dst.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.log(`${label} — upload erro: ${error.message}`);
      fail++;
      failures.push(path);
      continue;
    }
    console.log(`${label} — ok (${buf.length} bytes)`);
    ok++;
  }

  console.log(`\nResumo: ok=${ok} skip=${skip} fail=${fail}`);
  if (failures.length) {
    console.log("Falhas:");
    for (const f of failures) console.log(" -", f);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
