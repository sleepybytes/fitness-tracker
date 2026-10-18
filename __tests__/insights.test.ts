/// <reference types="jest" />
import { MEALS, SUPPLEMENTS, requiredItems } from '../src/data/plan';
import { dayCompletion, rangeReport, streaks } from '../src/lib/insights';
import { atTime } from '../src/lib/date';
import { buildSchedule } from '../src/lib/notifications';
import type { DayLog, Logs, Settings } from '../src/lib/types';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));

const T = '2026-01-01T00:00:00.000Z';

function fullDay(amounts: Record<string, number> = { protein: 2, multivitamin: 1, omega3: 1 }): DayLog {
  const items: Record<string, string> = {};
  for (const m of MEALS) for (const i of requiredItems(m)) items[i.id] = T;
  const supplements = Object.fromEntries(Object.entries(amounts).map(([k, amount]) => [k, { amount, at: T }]));
  return { items, supplements, waterMl: 3000, workout: { groups: ['back', 'biceps'], entries: [], at: T } };
}

function without(day: DayLog, ...itemIds: string[]): DayLog {
  const items = { ...day.items };
  for (const id of itemIds) delete items[id];
  return { ...day, items };
}

const endOfDay = (key: string) => atTime(key, '23:59');

describe('dayCompletion', () => {
  it('marks a fully logged day as complete', () => {
    const r = dayCompletion('2026-03-01', fullDay(), endOfDay('2026-03-01'));
    expect(r.complete).toBe(true);
    expect(r.percent).toBe(100);
    expect(r.mealsDone).toBe(MEALS.length);
    expect(r.suppsTaken).toBe(SUPPLEMENTS.length);
  });

  it('distinguishes partial and missed meals', () => {
    const lunchIds = MEALS.find((m) => m.id === 'lunch')!.items.map((i) => i.id);
    const day = without(fullDay(), 'bf_eggs', ...lunchIds);
    const r = dayCompletion('2026-03-01', day, endOfDay('2026-03-01'));
    const status = Object.fromEntries(r.meals.map((m) => [m.meal.id, m.status]));
    expect(status.breakfast).toBe('partial');
    expect(status.lunch).toBe('missed');
    expect(r.meals.find((m) => m.meal.id === 'breakfast')!.missingItems).toEqual(['bf_eggs']);
    expect(r.complete).toBe(false);
    expect(r.percent).toBeLessThan(100);
  });

  it('ignores optional items', () => {
    const r = dayCompletion('2026-03-01', fullDay(), endOfDay('2026-03-01'));
    expect(r.meals.find((m) => m.meal.id === 'hydration')!.status).toBe('done');
  });

  it('treats an unlogged past day as all missed', () => {
    const r = dayCompletion('2026-03-01', undefined, endOfDay('2026-03-01'));
    expect(r.meals.every((m) => m.status === 'missed')).toBe(true);
    expect(r.percent).toBe(0);
  });

  it('does not count future slots as missed', () => {
    const r = dayCompletion('2026-03-01', undefined, atTime('2026-03-01', '09:00'));
    const status = Object.fromEntries(r.meals.map((m) => [m.meal.id, m.status]));
    expect(status.waking).toBe('missed');
    expect(status.breakfast).toBe('missed');
    expect(status.shake).toBe('upcoming');
    expect(status.bed).toBe('upcoming');
    expect(r.mealsDue).toBe(2);
    // multivitamin (08:00) is due, others are not
    expect(r.suppsDue).toBe(1);
  });

  it('returns null percent before anything is due', () => {
    const r = dayCompletion('2026-03-01', undefined, atTime('2026-03-01', '06:00'));
    expect(r.percent).toBeNull();
  });

  it('uses custom supplement times', () => {
    const r = dayCompletion('2026-03-01', undefined, atTime('2026-03-01', '09:00'), { multivitamin: '10:00' });
    expect(r.suppsDue).toBe(0);
  });
});

describe('rangeReport', () => {
  const now = atTime('2026-03-07', '23:59');
  const logs: Logs = {
    '2026-03-01': fullDay({ protein: 1, multivitamin: 2, omega3: 1 }),
    '2026-03-02': without(fullDay(), 'bed_milk', 'bed_almonds'),
    '2026-03-03': without(fullDay({ protein: 2, multivitamin: 1 }), 'bed_milk'),
    // 03-04 not logged at all
    '2026-03-05': fullDay(),
  };

  it('ranks the most missed items and meals', () => {
    const r = rangeReport(logs, '2026-03-01', '2026-03-05', now);
    expect(r.trackedDays).toBe(5);
    expect(r.itemMisses[0]).toEqual({ itemId: 'bed_milk', missedDays: 3, dueDays: 5 });
    const bed = r.mealMisses.find((m) => m.meal.id === 'bed')!;
    expect(bed).toMatchObject({ missed: 2, partial: 1, dueDays: 5 });
    expect(r.perfectDays).toBe(2);
  });

  it('computes supplement consistency and average dose', () => {
    const r = rangeReport(logs, '2026-03-01', '2026-03-05', now);
    const byId = Object.fromEntries(r.supplements.map((s) => [s.supp.id, s]));
    expect(byId.protein).toMatchObject({ takenDays: 4, dueDays: 5, avgDose: 1.8 });
    expect(byId.omega3).toMatchObject({ takenDays: 3, dueDays: 5 });
    expect(byId.multivitamin.avgDose).toBe(1.3);
  });

  it('estimates the nutrition gap', () => {
    const r = rangeReport(logs, '2026-03-01', '2026-03-05', now);
    expect(r.avgMissed.protein).toBeGreaterThan(0);
    expect(r.avgEaten.protein + r.avgMissed.protein).toBeCloseTo(r.avgPlanned.protein, -1);
  });

  it('skips days before the start date', () => {
    const r = rangeReport(logs, '2026-02-20', '2026-03-05', now, {}, '2026-03-01');
    expect(r.trackedDays).toBe(5);
    expect(r.days[0].key).toBe('2026-03-01');
  });

  it('handles an empty range', () => {
    const r = rangeReport({}, '2026-03-01', '2026-03-05', now, {}, '2026-03-10');
    expect(r.trackedDays).toBe(0);
    expect(r.adherence).toBeNull();
  });
});

describe('streaks', () => {
  it('counts current and best streaks; an unfinished today does not break the streak', () => {
    const logs: Logs = {
      '2026-03-01': fullDay(),
      '2026-03-02': fullDay(),
      '2026-03-03': fullDay(),
      '2026-03-04': without(fullDay(), 'bf_eggs'),
      '2026-03-05': fullDay(),
      '2026-03-06': fullDay(),
    };
    const s = streaks(logs, atTime('2026-03-07', '10:00'), {}, '2026-03-01');
    expect(s).toEqual({ current: 2, best: 3 });
  });
});

describe('buildSchedule', () => {
  const settings: Settings = {
    remindersOn: true,
    summaryOn: true,
    slotEnabled: {},
    suppTimes: { protein: '19:30', multivitamin: '08:00', omega3: '13:30' },
    workoutLogTime: '19:00',
  };
  const now = atTime('2026-03-01', '07:30');

  it('merges supplements into meal slots at the same time and stays under the iOS limit', () => {
    const s = buildSchedule({}, settings, now);
    expect(s.length).toBeLessThanOrEqual(60);
    const breakfast = s.find((r) => r.id === '2026-03-01_08:00')!;
    expect(breakfast.title).toContain('Breakfast + Multivitamin');
    expect(s.some((r) => r.id === '2026-03-01_07:00')).toBe(false); // already past
  });

  it('skips slots already logged', () => {
    const logs: Logs = { '2026-03-01': { ...fullDay(), supplements: {} } };
    const s = buildSchedule(logs, settings, now).filter((r) => r.id.startsWith('2026-03-01'));
    expect(s.map((r) => r.id).sort()).toEqual(['2026-03-01_08:00', '2026-03-01_13:30', '2026-03-01_19:30', '2026-03-01_summary']);
    expect(s.find((r) => r.id === '2026-03-01_08:00')!.title).toBe('Multivitamin · 8:00 AM');
  });

  it('respects disabled slots and the master switch', () => {
    const s = buildSchedule({}, { ...settings, slotEnabled: { breakfast: false, multivitamin: false } }, now);
    expect(s.some((r) => r.id === '2026-03-01_08:00')).toBe(false);
    expect(buildSchedule({}, { ...settings, remindersOn: false }, now)).toEqual([]);
  });
});
