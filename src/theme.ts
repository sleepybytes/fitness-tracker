import type { MealStatus } from './lib/insights';

/** Bold, dark-first palette. The app always renders dark. */
const palette = {
  bg: '#0B0B10',
  card: '#15151C',
  raised: '#1E1E28',
  border: '#272733',
  track: '#262632',
  text: '#F5F5F7',
  sub: '#9898A6',
  muted: '#5E5E6E',

  accent: '#D4FF3A',
  accentEnd: '#7CF5A6',
  onAccent: '#0B0B10',

  done: '#D4FF3A',
  partial: '#FFB547',
  missed: '#FF5C6C',
  upcoming: '#5E5E6E',

  supp: '#A594FF',
  water: '#3BD5FF',
  streak: '#FF8A3D',

  /** Single-hue ramp for completion (validated vs `card`): low → full. */
  heat: ['#4A5C1C', '#6A8A1E', '#8CB424', '#B0DC2C', '#D4FF3A'],
};

export type Theme = typeof palette;

export function useTheme(): Theme {
  return palette;
}

export const theme = palette;

export const STATUS_META: Record<MealStatus, { label: string; icon: string }> = {
  done: { label: 'Done', icon: 'checkmark.circle.fill' },
  partial: { label: 'Partial', icon: 'circle.lefthalf.filled' },
  missed: { label: 'Missed', icon: 'xmark.circle.fill' },
  upcoming: { label: 'Upcoming', icon: 'clock' },
};

/** Heatmap cell colour for a 0..100 day score; null = no data. */
export function heatColor(t: Theme, percent: number | null) {
  if (percent === null) return t.track;
  if (percent >= 100) return t.heat[4];
  if (percent >= 75) return t.heat[3];
  if (percent >= 50) return t.heat[2];
  if (percent >= 25) return t.heat[1];
  return t.heat[0];
}

export const radius = { card: 20, inner: 14, pill: 999 };
