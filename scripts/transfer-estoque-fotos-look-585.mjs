/**
 * Transfere fotos da Look 585 (estoque) do Lovable → Site Bike Time
 * e atualiza as URLs públicas em bikes_estoque.
 *
 * Uso: node scripts/transfer-estoque-fotos-look-585.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(resolve(root, "apps/gestao/package.json"));
const { createClient: createSb } = require("@supabase/supabase-js");

const BUCKET = "bikes-estoque-photos";

const BIKES = [
  {
    id: "500e505e-7993-4d8e-b63c-e4ce10fe90ca",
    label: "Look 585",
  },
];

const URL_FIELDS = [
  "foto_completa",
  "foto_cambio_frente",
  "foto_cambio_traseiro",
  "foto_freio",
  "foto_numero_serie",
];

/** Lê arquivo .env simples (chave=valor). */
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

/** Infere Content-Type pelo sufixo do arquivo. */
function guessContentType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Reescreve URL antiga (Lovable) para a URL pública do destino. */
function rewriteUrl(url, dstPublicBase) {
  if (!url) return url;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const path = url.slice(idx + marker.length);
  return `${dstPublicBase}/${path}`;
}

async function main() {
  const srcEnv = loadEnv("/Users/serasa/Documents/projetos/gestaobiketime/.env");
  const dstEnv = loadEnv(resolve(root, "apps/gestao/.env"));

  const srcUrl = srcEnv.SUPABASE_URL || srcEnv.VITE_SUPABASE_URL;
  const dstUrl = dstEnv.SUPABASE_URL || dstEnv.VITE_SUPABASE_URL;
  const srcKey =
    srcEnv.SUPABASE_SERVICE_ROLE_KEY ||
    srcEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    srcEnv.SUPABASE_ANON_KEY;
  const dstKey = dstEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!srcUrl || !srcKey) throw new Error("Origem sem URL/chave");
  if (!dstUrl || !dstKey) throw new Error("Destino sem SUPABASE_URL / SERVICE_ROLE_KEY");

  console.log("Origem:", srcUrl);
  console.log("Destino:", dstUrl);

  const src = createSb(srcUrl, srcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const dst = createSb(dstUrl, dstKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dstPublicBase = `${dstUrl}/storage/v1/object/public/${BUCKET}`;

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const bike of BIKES) {
    console.log(`\n=== ${bike.label} (${bike.id}) ===`);

    const { data: files, error: listErr } = await src.storage
      .from(BUCKET)
      .list(bike.id, { limit: 100 });
    if (listErr) {
      console.error("  list erro:", listErr.message);
      fail++;
      continue;
    }
    if (!files?.length) {
      console.log("  origem vazia");
      continue;
    }

    for (const f of files) {
      if (!f.name || f.name.endsWith("/")) continue;
      const path = `${bike.id}/${f.name}`;
      const label = `  ${f.name}`;

      const { data: existing } = await dst.storage.from(BUCKET).list(bike.id, {
        search: f.name,
        limit: 5,
      });
      if (existing?.some((e) => e.name === f.name && (e.metadata?.size ?? 0) > 0)) {
        console.log(`${label} — já existe, skip`);
        skip++;
        continue;
      }

      const { data: blob, error: dlErr } = await src.storage.from(BUCKET).download(path);
      if (dlErr || !blob) {
        console.error(`${label} — download falhou:`, dlErr?.message);
        fail++;
        continue;
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      const { error: upErr } = await dst.storage.from(BUCKET).upload(path, buffer, {
        contentType: guessContentType(path),
        upsert: true,
      });
      if (upErr) {
        console.error(`${label} — upload falhou:`, upErr.message);
        fail++;
        continue;
      }
      console.log(`${label} — ok (${buffer.length} bytes)`);
      ok++;
    }

    const { data: row, error: selErr } = await dst
      .from("bikes_estoque")
      .select(URL_FIELDS.join(","))
      .eq("id", bike.id)
      .maybeSingle();
    if (selErr) {
      console.error("  select URLs falhou:", selErr.message);
      continue;
    }
    if (!row) {
      console.error("  bike não encontrada no destino");
      continue;
    }

    const patch = {};
    for (const field of URL_FIELDS) {
      const next = rewriteUrl(row[field], dstPublicBase);
      if (next && next !== row[field]) patch[field] = next;
    }

    if (Object.keys(patch).length === 0) {
      console.log("  URLs já apontam para o destino (ou vazias)");
      continue;
    }

    const { error: updErr } = await dst
      .from("bikes_estoque")
      .update(patch)
      .eq("id", bike.id);
    if (updErr) {
      console.error("  update URLs falhou:", updErr.message);
      fail++;
    } else {
      console.log("  URLs atualizadas:", Object.keys(patch).join(", "));
    }
  }

  console.log(`\nResumo: ok=${ok} skip=${skip} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
