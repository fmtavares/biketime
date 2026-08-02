/**
 * Edge Function: emite ou consulta NFS-e da OS via Focus NFe.
 * Ação só sob demanda (CTA na OS paga) — nunca automática no status.
 *
 * Secrets:
 * - FOCUS_NFE_TOKEN (token homologação ou produção)
 * - FOCUS_NFE_BASE_URL (opcional; default homologação)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const IBGE_SP = "3550308";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Não autenticado." }, 401);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const papelOk = (roles ?? []).some((r) =>
      ["admin", "vendedor", "tecnico"].includes(r.role),
    );
    if (!papelOk) return json({ error: "Sem permissão para emitir NFS-e." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "consultar" ? "consultar" : "emitir";
    const osId = typeof body?.os_id === "string" ? body.os_id.trim() : "";
    if (!osId) return json({ error: "Informe os_id." }, 400);

    const focusToken = Deno.env.get("FOCUS_NFE_TOKEN");
    if (!focusToken) {
      return json(
        { error: "FOCUS_NFE_TOKEN não configurado nos secrets do Supabase." },
        500,
      );
    }
    const baseUrl = (
      Deno.env.get("FOCUS_NFE_BASE_URL") ??
      "https://homologacao.focusnfe.com.br/v2"
    ).replace(/\/$/, "");

    if (action === "consultar") {
      const result = await consultarEAtualizar(supabase, baseUrl, focusToken, osId);
      return json(result, result.error ? 400 : 200);
    }

    const result = await emitir(supabase, baseUrl, focusToken, osId);
    return json(result, result.error ? 400 : 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

/**
 * Consulta a nota na Focus pela ref gravada na OS e atualiza status/PDF.
 */
async function consultarEAtualizar(
  supabase: ReturnType<typeof createClient>,
  baseUrl: string,
  focusToken: string,
  osId: string,
) {
  const { data: os, error } = await supabase
    .from("ordens_servico")
    .select("id, nfse_ref, nfse_status")
    .eq("id", osId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!os) return { error: "OS não encontrada." };
  if (!os.nfse_ref) return { error: "Esta OS ainda não possui emissão de NFS-e." };

  const focus = await focusGet(baseUrl, focusToken, os.nfse_ref);
  if (focus.error && !focus.body) return { error: focus.error };

  const patch = mapFocusToOs(focus.body, os.nfse_ref);
  const { data: updated, error: upErr } = await supabase
    .from("ordens_servico")
    .update(patch)
    .eq("id", osId)
    .select(
      "id, nfse_ref, nfse_status, nfse_numero, nfse_codigo_verificacao, nfse_url_pdf, nfse_url_xml, nfse_erro, nfse_numero_rps, nfse_emitida_em",
    )
    .single();
  if (upErr) return { error: upErr.message };
  return { ok: true, os: updated, focus: focus.body };
}

/**
 * Emite NFS-e na Focus a partir dos dados da OS paga + cliente + nfse_settings.
 */
async function emitir(
  supabase: ReturnType<typeof createClient>,
  baseUrl: string,
  focusToken: string,
  osId: string,
) {
  const { data: os, error: osErr } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, valor_aprovado, valor_mao_obra, valor_pecas, servicos_executados, pecas_utilizadas, cliente_id, nfse_ref, nfse_status, nfse_numero, nfse_url_pdf",
    )
    .eq("id", osId)
    .maybeSingle();
  if (osErr) return { error: osErr.message };
  if (!os) return { error: "OS não encontrada." };
  if (os.status !== "pago") {
    return { error: "A OS precisa estar com status Pago para emitir NFS-e." };
  }
  if (os.nfse_status === "autorizado" && os.nfse_url_pdf) {
    return {
      ok: true,
      ja_autorizada: true,
      os: {
        id: os.id,
        nfse_ref: os.nfse_ref,
        nfse_status: os.nfse_status,
        nfse_numero: os.nfse_numero,
        nfse_url_pdf: os.nfse_url_pdf,
      },
    };
  }

  const { data: settings, error: setErr } = await supabase
    .from("nfse_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (setErr) return { error: setErr.message };
  if (!settings) return { error: "Configure nfse_settings (CNPJ, CCM, código do serviço)." };

  const cnpj = digits(settings.cnpj);
  const im = digits(settings.inscricao_municipal);
  const itemLista = String(settings.item_lista_servico ?? "").trim();
  if (cnpj.length !== 14) return { error: "CNPJ do prestador inválido em Configurações NFS-e." };
  if (!im) return { error: "Informe a Inscrição Municipal (CCM) em Configurações NFS-e." };
  if (!itemLista) {
    return { error: "Informe o item da lista de serviços em Configurações NFS-e." };
  }

  const { data: cliente, error: cliErr } = await supabase
    .from("clientes")
    .select(
      "id, nome, cpf, email, whatsapp, endereco, numero, apto, bairro, cidade, estado, cep",
    )
    .eq("id", os.cliente_id)
    .maybeSingle();
  if (cliErr) return { error: cliErr.message };
  if (!cliente) return { error: "Cliente da OS não encontrado." };

  const cpf = digits(cliente.cpf);
  if (cpf.length !== 11) {
    return { error: "Cliente sem CPF válido. Cadastre o CPF antes de emitir a nota." };
  }

  const valor = valorOs(os);
  if (valor <= 0) {
    return { error: "Valor de serviço zerado. Informe a mão de obra/serviço na OS antes de emitir a NFS-e." };
  }

  const discriminacao = montarDiscriminacao(os, settings.discriminacao_padrao);
  const codigoMunicipio = digits(settings.codigo_municipio) || IBGE_SP;
  const optanteSimples = !!settings.optante_simples_nacional;

  /**
   * Pref. SP: Simples Nacional deve usar leiaute 1 (só ISS), sem campos IBS/CBS/NBS.
   * Regime normal pode usar leiaute 2 com campos da reforma.
   */
  if (!optanteSimples) {
    const codigoNbs = String(settings.codigo_nbs ?? "").trim();
    const codigoIndOp = String(settings.codigo_indicador_operacao ?? "").trim();
    const cClassTrib = String(settings.ibs_cbs_classificacao_tributaria ?? "").trim();
    if (!codigoNbs || !codigoIndOp || !cClassTrib) {
      return {
        error:
          "Fora do Simples: preencha NBS, indicador de operação e classificação IBS/CBS em Parâmetro NFe.",
      };
    }
  }

  /** Nova ref se a anterior falhou; senão reutiliza para idempotência. */
  let ref = os.nfse_ref;
  if (!ref || os.nfse_status === "erro_autorizacao" || os.nfse_status === "erro") {
    ref = `os-${os.id.replace(/-/g, "")}-${Date.now().toString(36)}`;
  }

  const aliquotaPct = aliquotaParaSp(settings.aliquota);
  const tomador = {
    cpf,
    razao_social: cliente.nome,
    email: cliente.email || undefined,
    telefone: digits(cliente.whatsapp).slice(0, 11) || undefined,
    endereco: {
      logradouro: cliente.endereco || "Não informado",
      numero: cliente.numero || "S/N",
      complemento: cliente.apto || undefined,
      bairro: cliente.bairro || "Centro",
      codigo_municipio: codigoMunicipio,
      uf: (cliente.estado || "SP").slice(0, 2).toUpperCase(),
      cep: digits(cliente.cep).padStart(8, "0").slice(0, 8) || "01001000",
    },
  };
  const prestador = {
    cnpj,
    inscricao_municipal: im,
    codigo_municipio: codigoMunicipio,
  };

  const payload = optanteSimples
    ? montarPayloadLayout1({
      valor,
      itemLista,
      discriminacao,
      codigoMunicipio,
      aliquotaPct,
      natureza: String(settings.natureza_operacao || "1"),
      regimeEspecial: settings.regime_especial_tributacao
        ? String(settings.regime_especial_tributacao)
        : null,
      codigoTributario: settings.codigo_tributario_municipio
        ? String(settings.codigo_tributario_municipio)
        : null,
      prestador,
      tomador,
    })
    : montarPayloadLayout2({
      valor,
      itemLista,
      discriminacao,
      codigoMunicipio,
      aliquotaPct,
      natureza: String(settings.natureza_operacao || "1"),
      regimeEspecial: settings.regime_especial_tributacao
        ? String(settings.regime_especial_tributacao)
        : null,
      codigoTributario: settings.codigo_tributario_municipio
        ? String(settings.codigo_tributario_municipio)
        : null,
      codigoNbs: String(settings.codigo_nbs ?? "").trim(),
      codigoIndOp: String(settings.codigo_indicador_operacao ?? "").trim(),
      cClassTrib: String(settings.ibs_cbs_classificacao_tributaria ?? "").trim(),
      exigibilidadeSuspensa: Number(settings.exigibilidade_suspensa ?? 0),
      finalidadeEmissao: Number(settings.finalidade_emissao ?? 0),
      consumidorFinal: Number(settings.consumidor_final ?? 0),
      indicadorDestinatario: Number(settings.indicador_destinatario ?? 0),
      prestador,
      tomador,
    });

  const emitRes = await focusPost(baseUrl, focusToken, ref, payload);
  if (emitRes.http >= 400 && emitRes.body?.codigo) {
    const patch = {
      nfse_ref: ref,
      nfse_status: "erro_autorizacao",
      nfse_erro: normalizarErroFocus(
        String(
          emitRes.body.mensagem ||
            emitRes.body.codigo ||
            emitRes.error ||
            "Erro ao enviar NFS-e",
        ),
      ),
      nfse_emitida_em: new Date().toISOString(),
    };
    const { data: updatedErr } = await supabase
      .from("ordens_servico")
      .update(patch)
      .eq("id", osId)
      .select(
        "id, nfse_ref, nfse_status, nfse_numero, nfse_codigo_verificacao, nfse_url_pdf, nfse_url_xml, nfse_erro, nfse_numero_rps, nfse_emitida_em",
      )
      .single();
    return {
      error: patch.nfse_erro,
      correcao: emitRes.body.correcao,
      os: updatedErr,
      focus: emitRes.body,
    };
  }
  if (emitRes.error && !emitRes.body) {
    return { error: emitRes.error };
  }

  let focusBody = emitRes.body ?? {};
  /** Uma consulta rápida para pegar autorizado/PDF quando a Pref. responde rápido. */
  for (let i = 0; i < 3; i++) {
    await sleep(1500);
    const consult = await focusGet(baseUrl, focusToken, ref);
    if (consult.body?.status) {
      focusBody = consult.body;
      if (
        consult.body.status === "autorizado" ||
        consult.body.status === "erro_autorizacao"
      ) {
        break;
      }
    }
  }

  const patch = mapFocusToOs(focusBody, ref);
  if (patch.nfse_erro) patch.nfse_erro = normalizarErroFocus(patch.nfse_erro);
  const { data: updated, error: upErr } = await supabase
    .from("ordens_servico")
    .update(patch)
    .eq("id", osId)
    .select(
      "id, nfse_ref, nfse_status, nfse_numero, nfse_codigo_verificacao, nfse_url_pdf, nfse_url_xml, nfse_erro, nfse_numero_rps, nfse_emitida_em",
    )
    .single();
  if (upErr) return { error: upErr.message };

  if (patch.nfse_status === "erro_autorizacao") {
    return { error: patch.nfse_erro || "Nota rejeitada.", os: updated, focus: focusBody };
  }
  return { ok: true, os: updated, focus: focusBody, layout: optanteSimples ? "1" : "2" };
}

/** Mapeia resposta Focus → colunas da OS. */
function mapFocusToOs(body: Record<string, unknown> | null | undefined, ref: string) {
  const status = String(body?.status ?? "processando_autorizacao");
  const erros = body?.erros;
  let erroMsg: string | null = null;
  if (typeof body?.mensagem === "string") erroMsg = body.mensagem;
  if (Array.isArray(erros) && erros.length) {
    erroMsg = erros
      .map((e: { mensagem?: string }) => e?.mensagem)
      .filter(Boolean)
      .join("; ");
  }
  return {
    nfse_ref: ref,
    nfse_status: status,
    nfse_numero: body?.numero != null ? String(body.numero) : null,
    nfse_codigo_verificacao:
      body?.codigo_verificacao != null ? String(body.codigo_verificacao) : null,
    nfse_url_pdf: typeof body?.url === "string"
      ? body.url
      : typeof body?.caminho_pdf_nota_fiscal === "string"
      ? absoluteFocusUrl(String(body.caminho_pdf_nota_fiscal))
      : null,
    nfse_url_xml: typeof body?.caminho_xml_nota_fiscal === "string"
      ? absoluteFocusUrl(String(body.caminho_xml_nota_fiscal))
      : null,
    nfse_erro: status === "erro_autorizacao" || status === "erro"
      ? erroMsg || "Erro na autorização da NFS-e"
      : null,
    nfse_numero_rps: body?.numero_rps != null ? String(body.numero_rps) : null,
    nfse_emitida_em: new Date().toISOString(),
  };
}

function absoluteFocusUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `https://focusnfe.com.br${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Valor da NFS-e: só mão de obra/serviço.
 * Peças e total da OS ficam de fora até definição fiscal com o contador.
 */
function valorOs(os: {
  valor_mao_obra: number | null;
}) {
  return Number(os.valor_mao_obra || 0);
}

/** Monta discriminação da nota a partir dos serviços da OS. */
function montarDiscriminacao(
  os: { numero: string; servicos_executados: string | null; pecas_utilizadas: string | null },
  padrao: string | null,
) {
  const partes = [
    `OS ${os.numero}`,
    os.servicos_executados?.trim(),
    os.pecas_utilizadas?.trim() ? `Peças: ${os.pecas_utilizadas.trim()}` : null,
    padrao?.trim(),
  ].filter(Boolean);
  return partes.join("\n").slice(0, 2000) || `Serviços de manutenção — OS ${os.numero}`;
}

function digits(v: string | null | undefined) {
  return String(v ?? "").replace(/\D/g, "");
}

/**
 * Traduz erros conhecidos da Pref./Focus em orientação acionável.
 */
function normalizarErroFocus(msg: string): string {
  const m = msg.toLowerCase();
  if (
    m.includes("versão do schema") ||
    m.includes("versao do schema") ||
    (m.includes("ibs/cbs") && m.includes("endereço"))
  ) {
    return (
      `${msg} — Nosso envio à Focus já é leiaute 1 (Simples, sem IBS/CBS). ` +
      `A Focus ainda gera XML v2 e/ou usa o webservice antigo da Pref. SP. ` +
      `No painel Focus: Empresas → Documentos fiscais → desmarque “Ambiente da NFSe Nacional” ` +
      `e abra chamado pedindo uso de nfews.prefeitura.sp.gov.br (ou leiaute 1 para Simples).`
    );
  }
  if (m.includes("deverá ser utilizado o leiaute 1")) {
    return (
      `${msg} — Confirme Optante Simples em Parâmetro NFe. ` +
      `Se já estiver marcado, o ajuste precisa ser na Focus (eles ainda montam leiaute 2).`
    );
  }
  return msg;
}

/**
 * Focus SP espera alíquota em % (ex.: 5), não fração (0.05).
 */
function aliquotaParaSp(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n <= 1 ? n * 100 : n;
}

/**
 * Data/hora de emissão no fuso de SP, à meia-noite do dia civil atual.
 * Evita rejeição por "data final" quando o horário do servidor passa do corte.
 */
function dataEmissaoSp(): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${day}T00:00:00-03:00`;
}

type PayloadBase = {
  valor: number;
  itemLista: string;
  discriminacao: string;
  codigoMunicipio: string;
  aliquotaPct: number | null;
  natureza: string;
  regimeEspecial: string | null;
  codigoTributario: string | null;
  prestador: Record<string, unknown>;
  tomador: Record<string, unknown>;
};

/**
 * Leiaute 1 (Simples Nacional em SP): só ISS, sem campos IBS/CBS/NBS.
 * CCM em SP no layout 1 costuma ter 8 dígitos; tributacao_rps=T = tributado em SP.
 */
function montarPayloadLayout1(p: PayloadBase): Record<string, unknown> {
  const servico: Record<string, unknown> = {
    valor_servicos: p.valor,
    iss_retido: false,
    item_lista_servico: p.itemLista,
    discriminacao: p.discriminacao,
    codigo_municipio: p.codigoMunicipio,
  };
  if (p.aliquotaPct != null) servico.aliquota = p.aliquotaPct;
  if (p.codigoTributario) servico.codigo_tributario_municipio = p.codigoTributario;

  const im = String(
    (p.prestador as { inscricao_municipal?: string }).inscricao_municipal ?? "",
  ).replace(/\D/g, "");
  const prestador = {
    ...p.prestador,
    /** Layout 1 SP: inscrição municipal com 8 dígitos. */
    inscricao_municipal: im.padStart(8, "0").slice(-8),
  };

  const payload: Record<string, unknown> = {
    data_emissao: dataEmissaoSp(),
    natureza_operacao: p.natureza,
    optante_simples_nacional: true,
    incentivador_cultural: false,
    /** Campo próprio SP (Focus): T = tributado no município. */
    tributacao_rps: "T",
    prestador,
    tomador: p.tomador,
    servico,
  };
  if (p.regimeEspecial) payload.regime_especial_tributacao = p.regimeEspecial;
  return payload;
}

/**
 * Leiaute 2 (reforma): ISS + campos IBS/CBS exigidos pela Focus em SP.
 */
function montarPayloadLayout2(
  p: PayloadBase & {
    codigoNbs: string;
    codigoIndOp: string;
    cClassTrib: string;
    exigibilidadeSuspensa: number;
    finalidadeEmissao: number;
    consumidorFinal: number;
    indicadorDestinatario: number;
  },
): Record<string, unknown> {
  const servico: Record<string, unknown> = {
    valor_servicos: p.valor,
    valor_final_cobrado: p.valor,
    base_calculo: p.valor,
    iss_retido: 0,
    valor_ipi: 0,
    item_lista_servico: p.itemLista,
    discriminacao: p.discriminacao,
    codigo_municipio: p.codigoMunicipio,
    codigo_nbs: p.codigoNbs,
    codigo_indicador_operacao: p.codigoIndOp,
    ibs_cbs_classificacao_tributaria: p.cClassTrib,
  };
  if (p.aliquotaPct != null) servico.aliquota = p.aliquotaPct;
  if (p.codigoTributario) servico.codigo_tributario_municipio = p.codigoTributario;

  const payload: Record<string, unknown> = {
    data_emissao: dataEmissaoSp(),
    natureza_operacao: p.natureza,
    optante_simples_nacional: false,
    exigibilidade_suspensa: p.exigibilidadeSuspensa,
    finalidade_emissao: p.finalidadeEmissao,
    consumidor_final: p.consumidorFinal,
    indicador_destinatario: p.indicadorDestinatario,
    prestador: p.prestador,
    tomador: p.tomador,
    servico,
  };
  if (p.regimeEspecial) payload.regime_especial_tributacao = p.regimeEspecial;
  return payload;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function focusPost(
  baseUrl: string,
  token: string,
  ref: string,
  payload: Record<string, unknown>,
) {
  const url = `${baseUrl}/nfse?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${token}:`),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    return {
      http: res.status,
      body,
      error: body?.mensagem
        ? String(body.mensagem)
        : `Focus ${res.status}: ${text.slice(0, 300)}`,
    };
  }
  return { http: res.status, body, error: null as string | null };
}

async function focusGet(baseUrl: string, token: string, ref: string) {
  const url = `${baseUrl}/nfse/${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: { Authorization: "Basic " + btoa(`${token}:`) },
  });
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    return {
      http: res.status,
      body,
      error: body?.mensagem
        ? String(body.mensagem)
        : `Focus ${res.status}: ${text.slice(0, 300)}`,
    };
  }
  return { http: res.status, body, error: null as string | null };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
