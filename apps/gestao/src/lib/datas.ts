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
