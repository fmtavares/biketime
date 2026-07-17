export type FinancialSettings = {
  icms_pct: number;
  imposto_venda_pct: number;
  taxa_financeira_pct: number;
  comissao_pct: number;
  markup_pct: number;
};

export type BikeCosts = {
  custo_bike?: number | null;
  frete?: number | null;
  seguro?: number | null;
  montagem?: number | null;
  revisao_inicial?: number | null;
  custos_adicionais?: number | null;
};

export type CalcInput = BikeCosts & {
  settings: FinancialSettings;
  override_venda?: number;
  override_taxa_financeira_pct?: number | null;
  override_icms_pct?: number | null;
  override_imposto_venda_pct?: number | null;
  override_comissao_pct?: number | null;
  override_markup_pct?: number | null;
  desconto?: number;
};

export function calcBike(input: CalcInput) {
  const s = input.settings;
  const icms_pct = input.override_icms_pct ?? s.icms_pct;
  const imposto_venda_pct = input.override_imposto_venda_pct ?? s.imposto_venda_pct;
  const comissao_pct = input.override_comissao_pct ?? s.comissao_pct;
  const markup_pct = input.override_markup_pct ?? s.markup_pct;
  const custo_total =
    (Number(input.custo_bike) || 0) +
    (Number(input.frete) || 0) +
    (Number(input.seguro) || 0) +
    (Number(input.montagem) || 0) +
    (Number(input.revisao_inicial) || 0) +
    (Number(input.custos_adicionais) || 0);

  const icms = custo_total * (icms_pct / 100);
  const base = custo_total + icms;

  const venda_calc = base * (1 + markup_pct / 100);
  const venda_bruta = input.override_venda ?? venda_calc;
  const venda = Math.max(0, venda_bruta - (input.desconto || 0));

  const taxa_fin_pct = input.override_taxa_financeira_pct ?? s.taxa_financeira_pct;
  const taxa_financeira = venda * (taxa_fin_pct / 100);
  const imposto = venda * (imposto_venda_pct / 100);
  const comissao = venda * (comissao_pct / 100);

  const lucro = venda - base - taxa_financeira - imposto - comissao;
  const margem_pct = venda > 0 ? (lucro / venda) * 100 : 0;

  return {
    custo_total,
    icms,
    base,
    venda_sugerida: venda_calc,
    venda,
    taxa_financeira,
    imposto,
    comissao,
    lucro,
    margem_pct,
  };
}

export const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;
