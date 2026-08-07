/**
 * Helpers de data no fuso local (evita dia errado com timestamptz/UTC).
 */

/**
 * Converte timestamptz/ISO ou date para YYYY-MM-DD no fuso local do browser.
 * Ex.: "2026-07-25T01:00:00.000Z" em São Paulo → "2026-07-24".
 */
export function toDataLocal(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formata YYYY-MM-DD ou ISO para dd/mm/aaaa no fuso local.
 */
export function fmtDataLocal(value: string | null | undefined): string {
  const ymd = toDataLocal(value);
  if (!ymd) return "—";
  return new Date(ymd + "T12:00:00").toLocaleDateString("pt-BR");
}

/**
 * Formata data para dd/mm/aa (ano com 2 dígitos) no fuso local.
 */
export function fmtDataCurtaYY(value: string | null | undefined): string {
  const ymd = toDataLocal(value);
  if (!ymd) return "—";
  return new Date(ymd + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Timestamp ISO do "hoje" ao meio-dia local — grava data_pagamento sem virar outro dia em UTC.
 */
export function agoraComoPagamentoISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${day}T12:00:00`).toISOString();
}

/**
 * Limites do mês (início inclusivo, fim exclusivo) em ISO, no fuso local.
 * Usar em filtros .gte / .lt de colunas timestamptz.
 */
export function faixaMesLocalISO(mesRef: string) {
  const [ano, mes] = mesRef.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0).toISOString();
  const fim = new Date(ano, mes, 1, 0, 0, 0, 0).toISOString();
  return { inicio, fim, ano, mes };
}

/**
 * Retorna data no formato YYYY-MM-DD daqui a N meses a partir de uma data base.
 */
export function dataMaisMeses(meses: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + meses, from.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
