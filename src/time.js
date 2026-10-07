// Horários de parede como minutos desde 00:00 e datas como YYYY-MM-DD.
// A agenda é sempre no fuso do estabelecimento: 09:00 é 09:00 lá.

export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
  if (!m || Number(m[2]) > 59 || Number(m[1]) > 24) throw new RangeError(`Horário inválido: ${hhmm}`);
  const total = Number(m[1]) * 60 + Number(m[2]);
  if (total > 24 * 60) throw new RangeError(`Horário inválido: ${hhmm}`);
  return total;
}

export const toHHMM = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const DAY = 86_400_000;
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

/** Data e hora atuais no fuso do estabelecimento. */
export function nowIn(timeZone = 'America/Sao_Paulo', instant = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
