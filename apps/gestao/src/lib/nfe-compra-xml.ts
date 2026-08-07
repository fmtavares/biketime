/** Emitente extraído da NFe. */
export type NfeEmitente = {
  cnpj: string;
  nome: string;
  nomeFantasia: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
};

/** Item da nota (vira linha de compra_itens). */
export type NfeItemCompra = {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

/** Duplicata / parcela da cobrança. */
export type NfeParcelaCompra = {
  numero: number;
  valor: number;
  dataVencimento: string;
};

/** Resultado do parse de XML de NFe de compra. */
export type NfeCompraParseada = {
  chaveAcesso: string | null;
  numeroNf: string;
  dataEmissao: string;
  formaPagamento: string;
  valorTotal: number;
  emitente: NfeEmitente;
  itens: NfeItemCompra[];
  parcelas: NfeParcelaCompra[];
};

/**
 * Remove não-dígitos (CNPJ/telefone).
 */
export function soDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/**
 * Lista elementos pelo localName (ignora namespace da NFe).
 */
function byLocal(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll("*")).filter(
    (el) => el.localName === name,
  );
}

/**
 * Primeiro texto de tag pelo localName dentro de um nó.
 */
function textOf(root: ParentNode, name: string): string {
  const el = byLocal(root, name)[0];
  return (el?.textContent ?? "").trim();
}

/**
 * Converte data da NFe (YYYY-MM-DD ou datetime) para YYYY-MM-DD.
 */
function toDateIso(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return new Date().toISOString().slice(0, 10);
}

/**
 * Mapeia tPag da NFe para as formas usadas em compras.
 */
function formaPagamentoFromTPag(tPag: string): string {
  switch (tPag.padStart(2, "0")) {
    case "01":
      return "Dinheiro";
    case "03":
    case "04":
      return "Cartão";
    case "15":
    case "16":
      return "Boleto";
    case "17":
      return "Pix";
    case "18":
      return "Transferência";
    default:
      return "Boleto";
  }
}

/**
 * Número decimal BR/US a partir do texto da NFe.
 */
function num(raw: string): number {
  const n = Number(String(raw ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda em centavos (2 casas). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Ajusta parcelas para a soma bater exatamente no total alvo (centavos na última).
 */
export function reconciliarParcelasComTotal(
  parcelas: NfeParcelaCompra[],
  totalAlvo: number,
): NfeParcelaCompra[] {
  const alvo = round2(totalAlvo);
  const hoje = new Date().toISOString().slice(0, 10);
  if (!parcelas.length) {
    return [{ numero: 1, valor: alvo, dataVencimento: hoje }];
  }
  if (parcelas.length === 1) {
    return [{ ...parcelas[0], valor: alvo }];
  }

  const somaExcetoUltima = round2(
    parcelas.slice(0, -1).reduce((a, p) => a + p.valor, 0),
  );
  const valorUltima = round2(alvo - somaExcetoUltima);

  if (valorUltima < 0.01) {
    // Redistribui o total igualmente se a última ficaria inválida
    const n = parcelas.length;
    const cents = Math.round(alvo * 100);
    const base = Math.floor(cents / n);
    const rest = cents - base * n;
    return parcelas.map((p, i) => ({
      ...p,
      valor: (base + (i < rest ? 1 : 0)) / 100,
    }));
  }

  return [
    ...parcelas.slice(0, -1),
    { ...parcelas[parcelas.length - 1], valor: valorUltima },
  ];
}

/**
 * Garante que a soma (qtd × unitário) dos itens bata com o total da NF.
 * Frete/desconto/outros viram uma linha de ajuste.
 */
function reconciliarItensComTotal(
  itens: NfeItemCompra[],
  totalAlvo: number,
): NfeItemCompra[] {
  const soma = round2(
    itens.reduce((a, i) => a + i.quantidade * i.valorUnitario, 0),
  );
  const diff = round2(totalAlvo - soma);
  if (Math.abs(diff) < 0.01) return itens;
  return [
    ...itens,
    {
      descricao: "Ajuste NF (frete/desconto/outros)",
      quantidade: 1,
      valorUnitario: diff,
    },
  ];
}

/**
 * Lê XML de NFe (nfeProc ou NFe) e extrai dados para cadastrar compra.
 * Não cria produto/estoque — só fornecedor + itens textuais + parcelas.
 */
export function parseNfeCompraXml(xmlText: string): NfeCompraParseada {
  const trimmed = (xmlText ?? "").trim();
  if (!trimmed) throw new Error("Arquivo XML vazio");

  const doc = new DOMParser().parseFromString(trimmed, "text/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("XML inválido — não foi possível ler a NFe");

  const inf = byLocal(doc, "infNFe")[0];
  const root = inf ?? doc;
  if (!byLocal(root, "emit").length && !byLocal(doc, "emit").length) {
    throw new Error("XML não parece uma NFe (faltou emitente)");
  }

  const emitEl = byLocal(root, "emit")[0] ?? byLocal(doc, "emit")[0];
  if (!emitEl) throw new Error("Emitente não encontrado no XML");

  const cnpj = soDigitos(textOf(emitEl, "CNPJ") || textOf(emitEl, "CPF"));
  if (cnpj.length < 11) throw new Error("CNPJ/CPF do emitente inválido no XML");

  const nome = textOf(emitEl, "xNome") || "Fornecedor NFe";
  const nomeFantasia = textOf(emitEl, "xFant") || null;
  const ender = byLocal(emitEl, "enderEmit")[0];
  const cidade = ender ? textOf(ender, "xMun") || null : null;
  const estado = ender ? textOf(ender, "UF") || null : null;
  const foneRaw = ender
    ? textOf(ender, "fone")
    : textOf(emitEl, "fone");
  const telefone = soDigitos(foneRaw) || null;

  const ide = byLocal(root, "ide")[0] ?? byLocal(doc, "ide")[0];
  const numeroNf = textOf(ide ?? root, "nNF") || textOf(doc, "nNF");
  if (!numeroNf) throw new Error("Número da NF (nNF) não encontrado");

  const dataRaw =
    textOf(ide ?? root, "dhEmi") ||
    textOf(ide ?? root, "dEmi") ||
    textOf(doc, "dhEmi") ||
    textOf(doc, "dEmi");
  const dataEmissao = toDateIso(dataRaw);

  const infId =
    (inf as Element | undefined)?.getAttribute("Id") ??
    byLocal(doc, "infNFe")[0]?.getAttribute("Id") ??
    "";
  const chaveAcesso =
    soDigitos(infId).length >= 44
      ? soDigitos(infId).slice(-44)
      : soDigitos(textOf(doc, "chNFe")).length >= 44
        ? soDigitos(textOf(doc, "chNFe")).slice(-44)
        : null;

  const detList = byLocal(root, "det").length
    ? byLocal(root, "det")
    : byLocal(doc, "det");

  let itens: NfeItemCompra[] = detList
    .map((det) => {
      const prod = byLocal(det, "prod")[0] ?? det;
      const descricao = textOf(prod, "xProd") || textOf(prod, "cProd") || "Item";
      const quantidade = num(textOf(prod, "qCom")) || 1;
      const vProd = num(textOf(prod, "vProd"));
      let valorUnitario = num(textOf(prod, "vUnCom"));
      // Prefere rateio do vProd para a linha bater com a NF
      if (vProd > 0 && quantidade > 0) {
        valorUnitario = round2(vProd / quantidade);
      } else {
        valorUnitario = round2(valorUnitario);
      }
      return {
        descricao: descricao.slice(0, 500),
        quantidade,
        valorUnitario,
      };
    })
    .filter((i) => i.descricao.trim());

  if (!itens.length) throw new Error("Nenhum item encontrado na NFe");

  // vNF do total da nota (ICMSTot), não outro vNF solto no XML
  const icmsTot = byLocal(root, "ICMSTot")[0] ?? byLocal(doc, "ICMSTot")[0];
  const vNfRaw =
    (icmsTot ? num(textOf(icmsTot, "vNF")) : 0) ||
    num(textOf(root, "vNF")) ||
    num(textOf(doc, "vNF"));
  const somaItens = round2(
    itens.reduce((a, i) => a + i.quantidade * i.valorUnitario, 0),
  );
  const valorTotal = round2(vNfRaw || somaItens);

  const dupList = byLocal(root, "dup").length
    ? byLocal(root, "dup")
    : byLocal(doc, "dup");

  let parcelas: NfeParcelaCompra[] = dupList
    .map((dup, idx) => ({
      numero: idx + 1,
      valor: round2(num(textOf(dup, "vDup"))),
      dataVencimento: toDateIso(textOf(dup, "dVenc") || dataEmissao),
    }))
    .filter((p) => p.valor > 0);

  // Sem duplicatas: tenta detPag/vPag; senão 1 parcela = total da NF
  if (!parcelas.length) {
    const detPags = byLocal(root, "detPag").length
      ? byLocal(root, "detPag")
      : byLocal(doc, "detPag");
    parcelas = detPags
      .map((dp, idx) => ({
        numero: idx + 1,
        valor: round2(num(textOf(dp, "vPag"))),
        dataVencimento: dataEmissao,
      }))
      .filter((p) => p.valor > 0);
  }

  if (!parcelas.length) {
    parcelas = [
      {
        numero: 1,
        valor: valorTotal,
        dataVencimento: dataEmissao,
      },
    ];
  }

  // Itens e parcelas precisam somar o mesmo total da NF (senão o form bloqueia o save)
  itens = reconciliarItensComTotal(itens, valorTotal);
  parcelas = reconciliarParcelasComTotal(parcelas, valorTotal);

  const tPag = textOf(root, "tPag") || textOf(doc, "tPag") || "15";
  const formaPagamento = formaPagamentoFromTPag(tPag);

  return {
    chaveAcesso,
    numeroNf,
    dataEmissao,
    formaPagamento,
    valorTotal,
    emitente: {
      cnpj,
      nome,
      nomeFantasia,
      telefone,
      cidade,
      estado,
    },
    itens,
    parcelas,
  };
}

/**
 * Lê arquivo .xml como texto e faz o parse da NFe.
 */
export async function parseNfeCompraFile(file: File): Promise<NfeCompraParseada> {
  const text = await file.text();
  return parseNfeCompraXml(text);
}
