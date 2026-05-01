/**
 * Utilidades de data timezone-safe.
 *
 * REGRA: nunca usar `Date#toISOString()` para extrair "a data local" do usuário.
 * `toISOString()` converte para UTC; em UTC-3 isso pode mover o dia para frente
 * em qualquer horário >= 21:00 local.
 *
 * Para o domínio de agenda usamos:
 *   - `toLocalDateString(d)` para representar a DATA local (YYYY-MM-DD)
 *   - `toLocalTimeString(h, m)` para HH:MM:SS
 */

export function toLocalDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toLocalTimeString(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

/** Cria Date "meia-noite local" a partir de YYYY-MM-DD, sem cair em UTC. */
export function fromLocalDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Início (segunda-feira) da semana que contém a data, em horário local. */
export function startOfWeekMonday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay(); // 0=Dom..6=Sab
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + offsetToMonday);
  return out;
}

/** Adiciona N dias preservando timezone local. */
export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Verifica se um horário (data + hora local) já é passado. */
export function isPastSlot(date: Date, hour: number, minute = 0): boolean {
  const slot = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  return slot.getTime() < Date.now();
}

export function formatBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function formatBRShort(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export const DAY_NAMES_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
