export type DateKey = string; // local "YYYY-MM-DD"

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Inclusive list of keys from `from` to `to`. */
export function keysBetween(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Local Date for a "HH:MM" time on the given day. */
export function atTime(key: DateKey, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = fromKey(key);
  d.setHours(h, m, 0, 0);
  return d;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${suffix}`;
}

export function formatDayLabel(key: DateKey, today: DateKey): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function isValidTime(hhmm: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function normalizeTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
}
