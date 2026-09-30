import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, berlinNow, isoWeek, outletStatus, weekday, type Now } from '../src/lib/time.ts';
import type { Outlet } from '../src/lib/data/types.ts';

const kiosk: Outlet = {
  id: 8,
  name: 'Kochwerk Kiosk',
  order: 8,
  image: null,
  note: null,
  hours: [
    [['07:30', '10:00'], ['11:30', '14:00']],
    [['07:30', '10:00'], ['11:30', '14:00']],
    [['07:30', '10:00'], ['11:30', '14:00']],
    [['07:30', '10:00'], ['11:30', '14:00']],
    [],
    [],
    [],
  ],
};

const at = (hhmm: string, wd = 2): Now => {
  const [h, m] = hhmm.split(':').map(Number);
  return { date: '2026-09-30', minutes: h * 60 + m, weekday: wd };
};

test('opening status across a split day', () => {
  assert.deepEqual(outletStatus(kiosk, at('06:00')), { kind: 'later', at: '07:30' });
  assert.deepEqual(outletStatus(kiosk, at('07:00')), { kind: 'opening', minutes: 30 });
  assert.deepEqual(outletStatus(kiosk, at('08:00')), { kind: 'open', until: '10:00' });
  assert.deepEqual(outletStatus(kiosk, at('09:45')), { kind: 'closing', minutes: 15 });
  assert.deepEqual(outletStatus(kiosk, at('10:00')), { kind: 'later', at: '11:30' });
  assert.deepEqual(outletStatus(kiosk, at('11:00')), { kind: 'opening', minutes: 30 });
  assert.deepEqual(outletStatus(kiosk, at('14:00')), { kind: 'closed' });
  assert.deepEqual(outletStatus(kiosk, at('12:00', 4)), { kind: 'closedToday' });
});

test('calendar helpers', () => {
  assert.equal(weekday('2026-09-28'), 0);
  assert.equal(weekday('2026-10-04'), 6);
  assert.equal(addDays('2026-09-30', 5), '2026-10-05');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(isoWeek('2026-09-30'), 40);
  assert.equal(isoWeek('2027-01-01'), 53);
  assert.equal(isoWeek('2026-01-01'), 1);
});

test('Berlin clock, whatever the machine says', () => {
  // 2026-09-30 22:30 UTC is already 1 October in Hamburg (CEST, UTC+2).
  const now = berlinNow(new Date('2026-09-30T22:30:00Z'));
  assert.equal(now.date, '2026-10-01');
  assert.equal(now.minutes, 30);
  assert.equal(now.weekday, 3);
});
