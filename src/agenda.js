import { toMinutes, toHHMM, addDays, weekday, diffDays, overlaps } from './time.js';

/**
 * Normaliza a configuração de um profissional/recurso.
 *
 * schedule:   { 1: [['09:00','12:00'], ['13:00','18:00']], ... } (0 = domingo)
 * exceptions: { '2026-12-24': [['09:00','12:00']], '2026-12-25': [] } (dia especial ou fechado)
 * holidays:   ['2026-11-20', ...] (fechado)
 */
export function createCalendar({ schedule, exceptions = {}, holidays = [] }) {
  const parse = (ranges) => ranges
    .map(([s, e]) => {
      const start = toMinutes(s);
      const end = toMinutes(e);
      if (start >= end) throw new RangeError(`Intervalo vazio: ${s}-${e}`);
      return [start, end];
    })
    .sort((a, b) => a[0] - b[0]);

  const weekly = new Map(Object.entries(schedule).map(([d, r]) => [Number(d), parse(r)]));
  const special = new Map(Object.entries(exceptions).map(([d, r]) => [d, parse(r)]));
  const closed = new Set(holidays);

  return {
    /** Intervalos de atendimento do dia, em minutos. */
    hours(date) {
      if (special.has(date)) return special.get(date);
      if (closed.has(date)) return [];
      return weekly.get(weekday(date)) ?? [];
    },
  };
}

function busyIntervals(bookings, date, buffer) {
  return bookings
    .filter((b) => b.date === date && b.status !== 'canceled')
    .map((b) => {
      const start = toMinutes(b.start);
      const end = b.end ? toMinutes(b.end) : start + b.duration;
      // O intervalo de preparo/limpeza vale depois de cada atendimento
      return [start, end + buffer];
    });
}

/**
 * Horários livres para um serviço de `duration` minutos em `date`.
 *
 * - Respeita expediente, intervalos, feriados e dias especiais
 * - Não sobrepõe agendamentos existentes (nem o `buffer` depois deles)
 * - Antecedência mínima (`minNotice`) e janela máxima (`maxDaysAhead`)
 * - Horários em passos de `step` minutos, alinhados ao início do expediente
 *
 * @returns {string[]} ['09:00', '09:30', ...]
 */
export function availableSlots({
  calendar, date, duration, bookings = [], step = 15, buffer = 0, now, minNotice = 0, maxDaysAhead = 90,
}) {
  if (!(duration > 0)) throw new RangeError('duration deve ser > 0');
  if (now) {
    const ahead = diffDays(date, now.date);
    if (ahead < 0 || ahead > maxDaysAhead) return [];
  }
  const earliest = now && now.date === date ? now.minutes + minNotice : -Infinity;
  const busy = busyIntervals(bookings, date, buffer);
  const slots = [];

  for (const [open, close] of calendar.hours(date)) {
    for (let t = open; t + duration <= close; t += step) {
      if (t < earliest) continue;
      // O novo atendimento também precisa do buffer antes do próximo já marcado
      if (busy.some(([s, e]) => overlaps(t, t + duration + buffer, s, e))) continue;
      slots.push(toHHMM(t));
    }
  }
  return slots;
}

/** Disponibilidade de vários dias: [{ date, slots }], pulando dias sem horário. */
export function availableDays({ from, days = 14, ...options }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const slots = availableSlots({ ...options, date });
    if (slots.length) out.push({ date, slots });
  }
  return out;
}

/**
 * Vários profissionais: para cada horário, quem pode atender. Útil para
 * "qualquer profissional" ou para escolher o menos ocupado do dia.
 *
 * @param {{ id: string, calendar: object, bookings: object[] }[]} staff
 * @returns {{ time: string, staff: string[] }[]}
 */
export function availableWithStaff({ staff, date, duration, ...options }) {
  const map = new Map();
  for (const person of staff) {
    for (const time of availableSlots({ ...options, calendar: person.calendar, bookings: person.bookings ?? [], date, duration })) {
      if (!map.has(time)) map.set(time, []);
      map.get(time).push(person.id);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, ids]) => ({ time, staff: ids }));
}

/** Entre os disponíveis no horário, o com menos minutos agendados no dia. */
export function pickLeastBusy(staff, date, ids) {
  const load = (p) => (p.bookings ?? [])
    .filter((b) => b.date === date && b.status !== 'canceled')
    .reduce((s, b) => s + (b.end ? toMinutes(b.end) - toMinutes(b.start) : b.duration), 0);
  return staff.filter((p) => ids.includes(p.id)).sort((a, b) => load(a) - load(b) || a.id.localeCompare(b.id))[0]?.id ?? null;
}

/**
 * Confere um pedido de agendamento antes de gravar (a lista de horários
 * pode estar velha na tela do cliente). Retorna { ok } ou { ok: false, reason }.
 */
export function validateBooking({ start, ...options }) {
  const slots = availableSlots(options);
  if (slots.includes(start)) return { ok: true };
  return { ok: false, reason: 'Horário indisponível', alternatives: nearest(slots, start, 3) };
}

/** Os `n` horários livres mais próximos de `time`. */
export function nearest(slots, time, n = 3) {
  const t = toMinutes(time);
  return [...slots].sort((a, b) => Math.abs(toMinutes(a) - t) - Math.abs(toMinutes(b) - t) || a.localeCompare(b)).slice(0, n);
}
