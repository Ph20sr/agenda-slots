import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCalendar, availableSlots, availableDays, availableWithStaff, pickLeastBusy, validateBooking, nowIn, toMinutes,
} from '../src/index.js';

// Outubro de 2026: dia 6 é terça, 10 é sábado, 11 domingo, 12 feriado
const calendar = createCalendar({
  schedule: {
    1: [['09:00', '12:00'], ['13:00', '18:00']],
    2: [['09:00', '12:00'], ['13:00', '18:00']],
    3: [['09:00', '12:00'], ['13:00', '18:00']],
    4: [['09:00', '12:00'], ['13:00', '18:00']],
    5: [['09:00', '12:00'], ['13:00', '17:00']],
    6: [['08:00', '12:00']],
  },
  holidays: ['2026-10-12'],
  exceptions: { '2026-10-09': [['09:00', '10:00']] },
});

test('expediente, almoço e fim do expediente', () => {
  const slots = availableSlots({ calendar, date: '2026-10-06', duration: 60, step: 60 });
  assert.deepEqual(slots, ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
  // 11:30 + 60 min passaria do almoço
  assert.equal(availableSlots({ calendar, date: '2026-10-06', duration: 60, step: 30 }).includes('11:30'), false);
});

test('fechado no domingo e no feriado; dia especial substitui o horário normal', () => {
  assert.deepEqual(availableSlots({ calendar, date: '2026-10-11', duration: 30 }), []);
  assert.deepEqual(availableSlots({ calendar, date: '2026-10-12', duration: 30 }), []);
  assert.deepEqual(availableSlots({ calendar, date: '2026-10-09', duration: 30, step: 30 }), ['09:00', '09:30']);
});

test('agendamentos existentes e buffer de limpeza', () => {
  const bookings = [
    { date: '2026-10-06', start: '10:00', duration: 60 },
    { date: '2026-10-06', start: '14:00', end: '14:30', status: 'canceled' },
  ];
  const slots = availableSlots({ calendar, date: '2026-10-06', duration: 30, step: 30, bookings, buffer: 15 });
  // 09:30 terminaria 10:00 + 15 de buffer = invade a consulta das 10h
  assert.equal(slots.includes('09:00'), true);
  assert.equal(slots.includes('09:30'), false);
  assert.equal(slots.includes('10:00'), false);
  // 11:00 bate no buffer da consulta (até 11:15)
  assert.equal(slots.includes('11:00'), false);
  assert.equal(slots.includes('14:00'), true, 'agendamento cancelado libera o horário');
});

test('antecedência mínima e janela máxima', () => {
  const now = { date: '2026-10-06', minutes: toMinutes('13:40') };
  const today = availableSlots({ calendar, date: '2026-10-06', duration: 30, step: 30, now, minNotice: 60 });
  assert.equal(today[0], '15:00', 'precisa de 1h de antecedência a partir de 13:40');
  assert.deepEqual(availableSlots({ calendar, date: '2026-10-05', duration: 30, now }), [], 'passado');
  assert.deepEqual(availableSlots({ calendar, date: '2026-12-30', duration: 30, now, maxDaysAhead: 30 }), [], 'longe demais');
});

test('vários dias, pulando os fechados', () => {
  const days = availableDays({ calendar, from: '2026-10-09', days: 4, duration: 60, step: 60 });
  assert.deepEqual(days.map((d) => d.date), ['2026-10-09', '2026-10-10']);
  assert.deepEqual(days[1].slots, ['08:00', '09:00', '10:00', '11:00']);
});

test('vários profissionais e escolha do menos ocupado', () => {
  const staff = [
    { id: 'ana', calendar, bookings: [{ date: '2026-10-06', start: '09:00', duration: 120 }] },
    { id: 'bruno', calendar, bookings: [{ date: '2026-10-06', start: '13:00', duration: 30 }] },
  ];
  const grid = availableWithStaff({ staff, date: '2026-10-06', duration: 60, step: 60 });
  assert.deepEqual(grid.find((g) => g.time === '09:00').staff, ['bruno']);
  assert.deepEqual(grid.find((g) => g.time === '15:00').staff, ['ana', 'bruno']);
  assert.equal(pickLeastBusy(staff, '2026-10-06', ['ana', 'bruno']), 'bruno');
});

test('validação no momento de gravar sugere alternativas', () => {
  const bookings = [{ date: '2026-10-06', start: '15:00', duration: 60 }];
  const base = { calendar, date: '2026-10-06', duration: 60, step: 30, bookings };
  assert.deepEqual(validateBooking({ ...base, start: '09:00' }), { ok: true });
  const taken = validateBooking({ ...base, start: '15:00' });
  assert.equal(taken.ok, false);
  assert.deepEqual(taken.alternatives, ['14:00', '16:00', '13:30']);
});

test('configuração inválida falha cedo', () => {
  assert.throws(() => createCalendar({ schedule: { 1: [['10:00', '09:00']] } }), RangeError);
  assert.throws(() => availableSlots({ calendar, date: '2026-10-06', duration: 0 }), RangeError);
  assert.throws(() => toMinutes('25:00'), RangeError);
});

test('nowIn usa o fuso do estabelecimento', () => {
  assert.deepEqual(nowIn('America/Sao_Paulo', new Date('2026-10-07T02:30:00Z')), { date: '2026-10-06', minutes: 23 * 60 + 30 });
});
