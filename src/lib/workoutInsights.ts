import { MEALS, MUSCLE_GROUPS, WORKOUT_MEAL_ID, isWorkoutLogged, type MuscleGroup } from '../data/plan';
import { addDays, atTime, fromKey, keysBetween, toKey, type DateKey } from './date';
import type { Intensity, Logs } from './types';

const WORKOUT_TIME = MEALS.find((m) => m.id === WORKOUT_MEAL_ID)?.time ?? '18:00';

const isTrained = (logs: Logs, k: DateKey) => isWorkoutLogged(logs[k]) && !logs[k]?.workout?.rest;
const isRest = (logs: Logs, k: DateKey) => !!logs[k]?.workout?.rest && isWorkoutLogged(logs[k]);

export type WorkoutStats = {
  /** Days in range that count: workout time passed, or something logged. */
  trackedDays: number;
  trainingDays: number;
  restDays: number;
  missedDays: number;
  avgMinutes: number | null;
  intensity: Record<Intensity, number>;
  /** Training days per muscle group, highest first. */
  groupCounts: { group: MuscleGroup; days: number }[];
};

export function workoutStats(logs: Logs, from: DateKey, to: DateKey, now: Date, start?: DateKey): WorkoutStats {
  const first = start && start > from ? start : from;
  const keys = first <= to ? keysBetween(first, to) : [];
  const intensity: Record<Intensity, number> = { easy: 0, moderate: 0, hard: 0 };
  const counts = new Map<string, number>();
  let tracked = 0;
  let training = 0;
  let rest = 0;
  let missed = 0;
  let minuteSum = 0;
  let minuteDays = 0;

  for (const k of keys) {
    const due = atTime(k, WORKOUT_TIME).getTime() <= now.getTime();
    const logged = isWorkoutLogged(logs[k]);
    if (!due && !logged) continue;
    tracked++;
    if (!logged) {
      missed++;
      continue;
    }
    if (isRest(logs, k)) {
      rest++;
      continue;
    }
    training++;
    const w = logs[k]!.workout!;
    if (w.minutes) {
      minuteSum += w.minutes;
      minuteDays++;
    }
    if (w.intensity) intensity[w.intensity]++;
    for (const g of w.groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  return {
    trackedDays: tracked,
    trainingDays: training,
    restDays: rest,
    missedDays: missed,
    avgMinutes: minuteDays ? Math.round(minuteSum / minuteDays) : null,
    intensity,
    groupCounts: MUSCLE_GROUPS.map((group) => ({ group, days: counts.get(group.id) ?? 0 }))
      .filter((c) => c.days > 0)
      .sort((a, b) => b.days - a.days),
  };
}

/**
 * Consecutive days that were trained or marked as rest. Today only extends
 * the streak once logged; an unlogged today doesn't break it.
 */
export function trainingStreak(logs: Logs, now: Date, start?: DateKey): { current: number; best: number } {
  const today = toKey(now);
  const first = start ?? Object.keys(logs).sort()[0];
  if (!first || first > today) return { current: 0, best: 0 };
  let best = 0;
  let run = 0;
  for (const k of keysBetween(first, today)) {
    if (isWorkoutLogged(logs[k])) best = Math.max(best, ++run);
    else if (k !== today) run = 0;
  }
  let current = 0;
  for (let k = isWorkoutLogged(logs[today]) ? today : addDays(today, -1); k >= first && isWorkoutLogged(logs[k]); k = addDays(k, -1)) {
    current++;
  }
  return { current, best };
}

/** Days since each muscle group was last trained (null = never), longest gap first. */
export function lastTrained(logs: Logs, today: DateKey): { group: MuscleGroup; days: number | null }[] {
  const keys = Object.keys(logs)
    .filter((k) => k <= today && isTrained(logs, k))
    .sort()
    .reverse();
  const todayTime = fromKey(today).getTime();
  return MUSCLE_GROUPS.map((group) => {
    const k = keys.find((key) => logs[key]!.workout!.groups.includes(group.id));
    return { group, days: k ? Math.round((todayTime - fromKey(k).getTime()) / 86_400_000) : null };
  }).sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
}

export type WeightPoint = { key: DateKey; kg: number };

export function weightSeries(logs: Logs, from: DateKey, to: DateKey) {
  const points: WeightPoint[] = keysBetween(from, to)
    .filter((k) => logs[k]?.weightKg)
    .map((k) => ({ key: k, kg: logs[k]!.weightKg! }));
  const change = points.length >= 2 ? round1(points[points.length - 1].kg - points[0].kg) : null;
  return { points, latest: points.at(-1) ?? null, change };
}

/** Most recent weight on or before `day`, and its change vs the latest weight a week or more earlier. */
export function latestWeight(logs: Logs, day: DateKey) {
  const keys = Object.keys(logs)
    .filter((k) => k <= day && logs[k]?.weightKg)
    .sort()
    .reverse();
  if (!keys.length) return null;
  const kg = logs[keys[0]]!.weightKg!;
  const weekAgo = keys.find((k) => k <= addDays(keys[0], -7));
  return { key: keys[0], kg, weekChange: weekAgo ? round1(kg - logs[weekAgo]!.weightKg!) : null };
}

/** Exercises logged most often in the last `days` (ties: most recent first), for one-tap re-adding. */
export function recentEntries(logs: Logs, today: DateKey, exclude: string[] = [], days = 60, limit = 8): string[] {
  const stats = new Map<string, { count: number; last: DateKey }>();
  for (const k of keysBetween(addDays(today, -days), today)) {
    for (const e of logs[k]?.workout?.entries ?? []) {
      const s = stats.get(e) ?? { count: 0, last: k };
      stats.set(e, { count: s.count + 1, last: k > s.last ? k : s.last });
    }
  }
  return [...stats.entries()]
    .filter(([e]) => !exclude.includes(e))
    .sort((a, b) => b[1].count - a[1].count || (b[1].last > a[1].last ? 1 : -1))
    .slice(0, limit)
    .map(([e]) => e);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
