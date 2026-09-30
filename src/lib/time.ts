// Dates and opening hours, always in Hamburg time: the canteen's clock, whatever the device says.

import type { Outlet } from './data/types';

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type Now = {
  /** YYYY-MM-DD */
  date: string;
  /** Minutes since midnight. */
  minutes: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
};

export function berlinNow(at = new Date()): Now {
  const p = Object.fromEntries(parts.formatToParts(at).map((part) => [part.type, part.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: weekday(date) };
}

const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function weekday(iso: string): number {
  return (noon(iso).getUTCDay() + 6) % 7;
}

export function addDays(iso: string, days: number): string {
  const d = noon(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO 8601 week number ("KW 40"). */
export function isoWeek(iso: string): number {
  const d = noon(iso);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export type Status =
  | { kind: 'open'; until: string }
  | { kind: 'closing'; minutes: number }
  | { kind: 'opening'; minutes: number }
  | { kind: 'later'; at: string }
  | { kind: 'closed' }
  | { kind: 'closedToday' };

/** Where an outlet stands right now: open until 14:00, closing in 12 min, opens at 11:30 … */
export function outletStatus(outlet: Outlet, now: Now): Status {
  const slots = outlet.hours[now.weekday] ?? [];
  if (!slots.length) return { kind: 'closedToday' };
  for (const [open, close] of slots) {
    const from = toMinutes(open);
    const to = toMinutes(close);
    if (now.minutes >= from && now.minutes < to) {
      return to - now.minutes <= 30 ? { kind: 'closing', minutes: to - now.minutes } : { kind: 'open', until: close };
    }
  }
  const next = slots.find(([open]) => toMinutes(open) > now.minutes);
  if (!next) return { kind: 'closed' };
  const wait = toMinutes(next[0]) - now.minutes;
  return wait <= 60 ? { kind: 'opening', minutes: wait } : { kind: 'later', at: next[0] };
}

/** Traffic-light colour for a status: open, about to change, or closed. */
export function statusTone(status: Status): 'open' | 'soon' | 'closed' {
  if (status.kind === 'open') return 'open';
  if (status.kind === 'closing' || status.kind === 'opening') return 'soon';
  return 'closed';
}

/** "11:30–14:00 · 16:00–18:00" */
export function formatSlots(slots: [string, string][]): string {
  return slots.map(([a, b]) => `${a}–${b}`).join(' · ');
}
