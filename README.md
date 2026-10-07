# agenda-slots

[![CI](https://github.com/Ph20sr/agenda-slots/actions/workflows/ci.yml/badge.svg)](https://github.com/Ph20sr/agenda-slots/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

O "cérebro" de um sistema de agendamento online, para clínicas, barbearias, salões, consultórios, estúdios e consultorias: **quais horários mostrar para o cliente**. Não tem dependências e não está preso a nenhum banco ou framework.

## O que ele considera

- **Expediente por dia da semana**, com intervalo de almoço
- **Feriados** (fechado) e **dias especiais** (véspera de Natal só de manhã)
- **Agendamentos existentes**: agendamentos cancelados liberam o horário
- **Buffer** de preparo ou limpeza depois de cada atendimento
- **Antecedência mínima** ("agende com pelo menos 2h") e **janela máxima** ("até 60 dias")
- **Duração do serviço**: um corte de 30 min e uma coloração de 2h veem horários diferentes
- **Vários profissionais**: quem atende em cada horário e quem está menos ocupado
- **Validação na hora de gravar**, com sugestão dos horários mais próximos, porque a lista na tela do cliente pode estar desatualizada

## Uso

```js
import { createCalendar, availableSlots, validateBooking, nowIn } from 'agenda-slots';

const calendar = createCalendar({
  schedule: {
    1: [['09:00', '12:00'], ['13:00', '18:00']], // segunda
    2: [['09:00', '12:00'], ['13:00', '18:00']],
    3: [['09:00', '12:00'], ['13:00', '18:00']],
    4: [['09:00', '12:00'], ['13:00', '18:00']],
    5: [['09:00', '12:00'], ['13:00', '17:00']],
    6: [['08:00', '12:00']],                      // sábado
  },
  holidays: ['2026-11-20', '2026-12-25'],
  exceptions: { '2026-12-24': [['09:00', '12:00']] },
});

const bookings = await db.bookingsOf('ana', '2026-10-06'); // [{ date, start: '10:00', duration: 60 }]

availableSlots({
  calendar,
  date: '2026-10-06',
  duration: 45,          // minutos do serviço
  bookings,
  step: 15,              // grade de 15 em 15 min
  buffer: 10,            // limpeza depois de cada atendimento
  now: nowIn('America/Sao_Paulo'),
  minNotice: 120,        // 2h de antecedência
  maxDaysAhead: 60,
});
// ['09:00', '09:15', '11:15', '13:00', ...]

// Na hora de gravar (o horário pode ter sido pego por outra pessoa)
const check = validateBooking({ calendar, date: '2026-10-06', duration: 45, bookings, start: '15:00' });
// { ok: false, reason: 'Horário indisponível', alternatives: ['14:00', '16:00', '13:30'] }
```

### Vários profissionais

```js
import { availableWithStaff, pickLeastBusy } from 'agenda-slots';

const staff = [
  { id: 'ana', calendar: calendarAna, bookings: agendaAna },
  { id: 'bruno', calendar: calendarBruno, bookings: agendaBruno },
];

availableWithStaff({ staff, date: '2026-10-06', duration: 60 });
// [{ time: '09:00', staff: ['bruno'] }, { time: '15:00', staff: ['ana', 'bruno'] }, ...]

pickLeastBusy(staff, '2026-10-06', ['ana', 'bruno']); // 'bruno' ("qualquer profissional")
```

### Próximos dias com horário

```js
import { availableDays } from 'agenda-slots';

availableDays({ calendar, from: '2026-10-09', days: 14, duration: 60, bookings });
// [{ date: '2026-10-09', slots: [...] }, { date: '2026-10-10', slots: [...] }, ...]  (dias fechados não aparecem)
```

## Fuso horário

Datas (`YYYY-MM-DD`) e horas (`HH:MM`) são sempre o **horário local do estabelecimento**: "09:00" é 09:00 na clínica, não importa onde o servidor roda. `nowIn('America/Sao_Paulo')` dá a data e hora atuais nesse fuso para a regra de antecedência.

## Desenvolvimento

```bash
npm test
```

## Licença

MIT
