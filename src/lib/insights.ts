import { NUTRITION, SUPPLEMENT_NUTRITION, type Macro } from '../data/nutrition';
import { MEALS, SUPPLEMENTS, isItemDone, requiredItems, type Meal, type Supplement } from '../data/plan';
import { addDays, atTime, keysBetween, toKey, type DateKey } from './date';
import { emptyDay, type DayLog, type Logs } from './types';

export type MealStatus = 'done' | 'partial' | 'missed' | 'upcoming';

export type MealResult = {
  meal: Meal;
  status: MealStatus;
  /** Required items not ticked. */
  missingItems: string[];
  /** Fraction of required items ticked (0..1). */
  fraction: number;
  due: boolean;
};

export type SuppResult = {
  supp: Supplement;
  time: string;
  amount: number | null;
  due: boolean;
  missed: boolean;
};

export type DayResult = {
  key: DateKey;
  meals: MealResult[];
  supplements: SuppResult[];
  mealsDone: number;
  mealsDue: number;
  suppsTaken: number;
  suppsDue: number;
  /** 0..100 over everything that is due; null when nothing is due yet. */
  percent: number | null;
  /** Everything for the whole day is done. */
  complete: boolean;
  waterMl: number;
};

const isDue = (key: DateKey, hhmm: string, now: Date) => atTime(key, hhmm).getTime() <= now.getTime();

export function dayCompletion(
  key: DateKey,
  log: DayLog | undefined,
  now: Date,
  suppTimes: Record<string, string> = {},
): DayResult {
  const day = log ?? emptyDay();

  const meals: MealResult[] = MEALS.map((meal) => {
    const req = requiredItems(meal);
    const ticked = req.filter((i) => isItemDone(day, i.id));
    const missingItems = req.filter((i) => !isItemDone(day, i.id)).map((i) => i.id);
    const fraction = req.length ? ticked.length / req.length : 1;
    const due = isDue(key, meal.time, now);
    let status: MealStatus;
    if (missingItems.length === 0) status = 'done';
    else if (ticked.length > 0) status = 'partial';
    else status = due ? 'missed' : 'upcoming';
    return { meal, status, missingItems, fraction, due };
  });

  const supplements: SuppResult[] = SUPPLEMENTS.map((supp) => {
    const time = suppTimes[supp.id] ?? supp.defaultTime;
    const amount = day.supplements[supp.id]?.amount ?? null;
    const due = isDue(key, time, now);
    return { supp, time, amount, due, missed: due && amount === null };
  });

  // A meal or supplement counts once its time has passed, or earlier if it was already logged.
  const countedMeals = meals.filter((m) => m.due || m.fraction > 0);
  const countedSupps = supplements.filter((s) => s.due || s.amount !== null);
  const units = countedMeals.length + countedSupps.length;
  const score =
    countedMeals.reduce((a, m) => a + m.fraction, 0) + countedSupps.filter((s) => s.amount !== null).length;

  const mealsDone = meals.filter((m) => m.status === 'done').length;
  const suppsTaken = supplements.filter((s) => s.amount !== null).length;

  return {
    key,
    meals,
    supplements,
    mealsDone,
    mealsDue: meals.filter((m) => m.due).length,
    suppsTaken,
    suppsDue: supplements.filter((s) => s.due).length,
    percent: units ? Math.round((score / units) * 100) : null,
    complete: mealsDone === meals.length && suppsTaken === supplements.length,
    waterMl: day.waterMl,
  };
}

export type MealMiss = { meal: Meal; missed: number; partial: number; dueDays: number };
export type ItemMiss = { itemId: string; missedDays: number; dueDays: number };
export type SuppStat = { supp: Supplement; takenDays: number; dueDays: number; avgDose: number | null };

export type RangeReport = {
  days: DayResult[];
  /** Days that had anything due (used as the denominator everywhere). */
  trackedDays: number;
  adherence: number | null;
  perfectDays: number;
  mealMisses: MealMiss[];
  itemMisses: ItemMiss[];
  supplements: SuppStat[];
  /** Daily averages over tracked days. */
  avgPlanned: Macro;
  avgEaten: Macro;
  avgMissed: Macro;
  avgWaterMl: number | null;
};

const zero = (): Macro => ({ kcal: 0, protein: 0 });
const add = (a: Macro, b: Macro, k = 1) => {
  a.kcal += b.kcal * k;
  a.protein += b.protein * k;
};
const avg = (m: Macro, n: number): Macro =>
  n ? { kcal: Math.round(m.kcal / n), protein: Math.round(m.protein / n) } : zero();

/**
 * Report for [from, to]. Days before `startDate` (first use) and days with
 * nothing due yet are ignored so they never count as missed.
 */
export function rangeReport(
  logs: Logs,
  from: DateKey,
  to: DateKey,
  now: Date,
  suppTimes: Record<string, string> = {},
  startDate?: DateKey,
): RangeReport {
  const first = startDate && startDate > from ? startDate : from;
  const days = first <= to ? keysBetween(first, to).map((k) => dayCompletion(k, logs[k], now, suppTimes)) : [];
  const tracked = days.filter((d) => d.percent !== null);

  const mealMisses: MealMiss[] = MEALS.map((meal) => ({ meal, missed: 0, partial: 0, dueDays: 0 }));
  const itemCounts = new Map<string, ItemMiss>();
  const supps: (SuppStat & { doseSum: number })[] = SUPPLEMENTS.map((supp) => ({
    supp,
    takenDays: 0,
    dueDays: 0,
    avgDose: null,
    doseSum: 0,
  }));
  const planned = zero();
  const eaten = zero();
  let waterSum = 0;
  let waterDays = 0;

  for (const d of tracked) {
    d.meals.forEach((m, i) => {
      if (!m.due) return;
      const mm = mealMisses[i];
      mm.dueDays++;
      if (m.status === 'missed') mm.missed++;
      if (m.status === 'partial') mm.partial++;
      for (const item of requiredItems(m.meal)) {
        const c = itemCounts.get(item.id) ?? { itemId: item.id, missedDays: 0, dueDays: 0 };
        c.dueDays++;
        const macro = NUTRITION[item.id] ?? zero();
        add(planned, macro);
        if (m.missingItems.includes(item.id)) c.missedDays++;
        else add(eaten, macro);
        itemCounts.set(item.id, c);
      }
    });
    d.supplements.forEach((s, i) => {
      const st = supps[i];
      const macro = SUPPLEMENT_NUTRITION[s.supp.id] ?? zero();
      if (s.due) {
        st.dueDays++;
        add(planned, macro, s.supp.doses[0]);
      }
      if (s.amount !== null) {
        st.takenDays++;
        st.doseSum += s.amount;
        add(eaten, macro, s.amount);
      }
    });
    // Water only counts for finished days, so a half-finished today doesn't drag the average down.
    if (d.key < toKey(now)) {
      waterSum += d.waterMl;
      waterDays++;
    }
  }

  const n = tracked.length;
  const missed = { kcal: Math.max(0, planned.kcal - eaten.kcal), protein: Math.max(0, planned.protein - eaten.protein) };

  return {
    days,
    trackedDays: n,
    adherence: n ? Math.round(tracked.reduce((a, d) => a + (d.percent ?? 0), 0) / n) : null,
    perfectDays: days.filter((d) => d.complete).length,
    mealMisses: mealMisses
      .filter((m) => m.missed + m.partial > 0)
      .sort((a, b) => b.missed - a.missed || b.partial - a.partial),
    itemMisses: [...itemCounts.values()]
      .filter((c) => c.missedDays > 0)
      .sort((a, b) => b.missedDays - a.missedDays),
    supplements: supps.map(({ doseSum, ...s }) => ({
      ...s,
      avgDose: s.takenDays ? Math.round((doseSum / s.takenDays) * 10) / 10 : null,
    })),
    avgPlanned: avg(planned, n),
    avgEaten: avg(eaten, n),
    avgMissed: avg(missed, n),
    avgWaterMl: waterDays ? Math.round(waterSum / waterDays) : null,
  };
}

/**
 * Streaks of fully completed days. Today only extends the current streak once
 * it's complete; an unfinished today doesn't break it.
 */
export function streaks(
  logs: Logs,
  now: Date,
  suppTimes: Record<string, string> = {},
  startDate?: DateKey,
): { current: number; best: number } {
  const today = toKey(now);
  const keys = Object.keys(logs);
  const first = startDate ?? keys.sort()[0];
  if (!first || first > today) return { current: 0, best: 0 };

  let best = 0;
  let run = 0;
  for (const k of keysBetween(first, today)) {
    const done = dayCompletion(k, logs[k], now, suppTimes).complete;
    if (done) best = Math.max(best, ++run);
    else if (k !== today) run = 0;
  }

  let current = 0;
  let k = dayCompletion(today, logs[today], now, suppTimes).complete ? today : addDays(today, -1);
  while (k >= first && dayCompletion(k, logs[k], now, suppTimes).complete) {
    current++;
    k = addDays(k, -1);
  }
  return { current, best };
}
