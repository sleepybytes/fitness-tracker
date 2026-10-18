/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';

import TodayScreen from '../app/(tabs)/index';
import { WorkoutLogger } from '../src/components/WorkoutLogger';
import { workoutSummary } from '../src/data/plan';
import { addDays, atTime, toKey } from '../src/lib/date';
import { dayCompletion } from '../src/lib/insights';
import { buildSchedule } from '../src/lib/notifications';
import type { DayLog, Logs, Settings, WorkoutLog } from '../src/lib/types';
import { latestWeight, lastTrained, recentEntries, trainingStreak, weightSeries, workoutStats } from '../src/lib/workoutInsights';
import { migrate, useTracker } from '../src/store/useTracker';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
let mockParams: { tab?: string } = {};
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockParams,
  router: { setParams: (p: object) => mockSetParams(p) },
}));

const T = '2026-01-01T00:00:00.000Z';
const day = (workout?: Partial<WorkoutLog>, extra: Partial<DayLog> = {}): DayLog => ({
  items: {},
  supplements: {},
  waterMl: 0,
  ...(workout ? { workout: { groups: [], entries: [], at: T, ...workout } } : {}),
  ...extra,
});

describe('store migration v1 → v2', () => {
  it('turns a ticked diet "Workout" into a workout log and fills new settings', () => {
    const v1 = {
      logs: { '2026-03-01': { items: { workout_done: T, bf_eggs: T }, supplements: {}, waterMl: 0 } },
      settings: { remindersOn: true, summaryOn: true, slotEnabled: {}, suppTimes: {} },
      startDate: '2026-03-01',
    };
    const out = migrate(v1, 1);
    const d = out.logs['2026-03-01'];
    expect(d.items).toEqual({ bf_eggs: T });
    expect(d.workout?.entries).toEqual(['Strength training']);
    expect(workoutSummary(d)).toBe('1 exercise');
    expect(out.settings.workoutLogTime).toBe('19:00');
  });
});

describe('workout ↔ diet timeline', () => {
  const status = (log: DayLog | undefined, hhmm: string) =>
    dayCompletion('2026-03-01', log, atTime('2026-03-01', hhmm)).meals.find((m) => m.meal.id === 'workout')!.status;

  it('is done when trained or on a rest day, missed after 6 PM otherwise', () => {
    expect(status(day({ groups: ['back'] }), '20:00')).toBe('done');
    expect(status(day({ rest: true }), '20:00')).toBe('done');
    expect(status(day(), '20:00')).toBe('missed');
    expect(status(day(), '17:00')).toBe('upcoming');
    expect(status(day({ groups: [] }), '20:00')).toBe('missed'); // empty log ≠ logged
  });

  it('summarises the log', () => {
    expect(workoutSummary(day({ groups: ['back', 'biceps'], minutes: 45 }))).toBe('Back + Biceps · 45 min');
    expect(workoutSummary(day({ entries: ['Cycling 15 min'] }))).toBe('1 exercise');
    expect(workoutSummary(day({ rest: true }))).toBe('Rest day');
    expect(workoutSummary(day())).toBeNull();
  });
});

describe('workout insights', () => {
  const now = atTime('2026-03-07', '21:00');
  const logs: Logs = {
    '2026-03-01': day({ groups: ['back', 'biceps'], minutes: 60, intensity: 'hard', entries: ['Hammer curl', 'Deadlift'] }),
    '2026-03-02': day({ groups: ['leg'], minutes: 45, intensity: 'moderate', entries: ['Squat'] }),
    '2026-03-03': day({ rest: true }),
    // 03-04 nothing logged → missed
    '2026-03-05': day({ groups: ['back', 'cardio'], entries: ['Hammer curl', 'Cycling 15 min'] }),
    '2026-03-06': day({ groups: ['biceps'], minutes: 30, entries: ['Hammer curl'] }, { weightKg: 72.4 }),
    '2026-03-07': day({ groups: ['shoulder'] }, { weightKg: 72.9 }),
  };

  it('counts training, rest, missed days and muscle groups', () => {
    const s = workoutStats(logs, '2026-03-01', '2026-03-07', now);
    expect(s).toMatchObject({ trackedDays: 7, trainingDays: 5, restDays: 1, missedDays: 1, avgMinutes: 45 });
    expect(s.intensity).toEqual({ easy: 0, moderate: 1, hard: 1 });
    expect(s.groupCounts.slice(0, 2).map((c) => [c.group.id, c.days])).toEqual([
      ['back', 2],
      ['biceps', 2],
    ]);
  });

  it('does not count today as missed before workout time', () => {
    const s = workoutStats({}, '2026-03-07', '2026-03-07', atTime('2026-03-07', '12:00'));
    expect(s.trackedDays).toBe(0);
    expect(s.missedDays).toBe(0);
  });

  it('tracks streaks where rest days count and an unlogged day breaks it', () => {
    expect(trainingStreak(logs, now, '2026-03-01')).toEqual({ current: 3, best: 3 });
  });

  it('reports days since each group was last trained', () => {
    const lt = Object.fromEntries(lastTrained(logs, '2026-03-07').map((x) => [x.group.id, x.days]));
    expect(lt.shoulder).toBe(0);
    expect(lt.leg).toBe(5);
    expect(lt.neck).toBeNull();
  });

  it('builds the weight series and week change', () => {
    const w = weightSeries(logs, '2026-03-01', '2026-03-07');
    expect(w.points.map((p) => p.kg)).toEqual([72.4, 72.9]);
    expect(w.change).toBe(0.5);
    expect(latestWeight({ ...logs, '2026-02-27': day(undefined, { weightKg: 71.8 }) }, '2026-03-07')).toEqual({
      key: '2026-03-07',
      kg: 72.9,
      weekChange: 1.1,
    });
  });

  it('suggests frequent recent exercises, excluding ones already added', () => {
    expect(recentEntries(logs, '2026-03-07')).toEqual(['Hammer curl', 'Cycling 15 min', 'Squat', 'Deadlift']);
    expect(recentEntries(logs, '2026-03-07', ['Hammer curl'])[0]).toBe('Cycling 15 min');
  });
});

describe('7 PM workout reminder', () => {
  const settings: Settings = {
    remindersOn: true,
    summaryOn: true,
    slotEnabled: {},
    suppTimes: { protein: '19:30', multivitamin: '08:00', omega3: '13:30' },
    workoutLogTime: '19:00',
  };
  const now = atTime('2026-03-01', '07:30');
  const ids = (logs: Logs) => buildSchedule(logs, settings, now).map((r) => r.id);

  it('is scheduled at 7 PM and opens the exercise tab', () => {
    const r = buildSchedule({}, settings, now).find((x) => x.id === '2026-03-01_19:00')!;
    expect(r.title).toBe("Log today's workout · 7:00 PM");
    expect(r.url).toBe('/?tab=exercise');
  });

  it('is skipped once logged or on a rest day, and can be turned off', () => {
    expect(ids({ '2026-03-01': day({ groups: ['back'] }) })).not.toContain('2026-03-01_19:00');
    expect(ids({ '2026-03-01': day({ rest: true }) })).not.toContain('2026-03-01_18:00');
    expect(buildSchedule({}, { ...settings, slotEnabled: { workoutLog: false } }, now).map((r) => r.id)).not.toContain('2026-03-01_19:00');
  });

  it('keeps every scheduled day complete within the iOS limit', () => {
    const all = buildSchedule({}, settings, atTime('2026-03-01', '00:01'));
    expect(all.length).toBeLessThanOrEqual(60);
    expect(all.at(-1)!.id).toBe('2026-03-05_summary');
  });
});

describe('Exercise tab', () => {
  const today = toKey(new Date());
  beforeEach(() => useTracker.getState().resetAll());

  it('logs groups, typed and quick-added exercises, duration, and rest day', async () => {
    useTracker.setState((s) => ({ logs: { ...s.logs, [addDays(today, -1)]: day({ entries: ['Hammer curl 3x12'] }) } }));
    await render(<WorkoutLogger day={today} today={today} />);

    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Biceps'));
    await fireEvent.changeText(screen.getByLabelText('New exercise'), '  Cycling 15 min ');
    await fireEvent.press(screen.getByLabelText('Add exercise'));
    await fireEvent.press(screen.getByLabelText('Add Hammer curl 3x12'));
    await fireEvent.press(screen.getByText('45 min'));

    let w = useTracker.getState().logs[today].workout!;
    expect(w.groups).toEqual(['back', 'biceps']);
    expect(w.entries).toEqual(['Cycling 15 min', 'Hammer curl 3x12']);
    expect(w.minutes).toBe(45);
    expect(screen.getByText('Back + Biceps · 45 min')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove Cycling 15 min'));
    await fireEvent(screen.getByLabelText('Rest day'), 'valueChange', true);
    w = useTracker.getState().logs[today].workout!;
    expect(w.entries).toEqual(['Hammer curl 3x12']);
    expect(w.rest).toBe(true);
    expect(screen.getAllByText('Rest day')).toHaveLength(2); // status title + switch label
  });

  it('logs body weight with the steppers', async () => {
    useTracker.setState((s) => ({ logs: { ...s.logs, [addDays(today, -3)]: day(undefined, { weightKg: 72 }) } }));
    await render(<WorkoutLogger day={today} today={today} />);
    await fireEvent.press(screen.getByLabelText('Increase weight by 0.1 kg'));
    expect(useTracker.getState().logs[today].weightKg).toBe(72.1);
  });

  it('opens the exercise tab from the 7 PM notification link (?tab=exercise)', async () => {
    mockParams = { tab: 'exercise' };
    try {
      await render(<TodayScreen />);
      expect(screen.getByText('What did you train?')).toBeTruthy();
      expect(mockSetParams).toHaveBeenCalledWith({ tab: undefined });
    } finally {
      mockParams = {};
    }
  });

  it('timeline workout row shows the log and opens the exercise tab', async () => {
    useTracker.setState({ logs: { [today]: day({ groups: ['leg'], minutes: 60 }) } });
    await render(<TodayScreen />);
    expect(screen.getByText('Leg · 60 min')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Exercise, ✓' })).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Open workout log')[0]);
    expect(screen.getByText('What did you train?')).toBeTruthy();
  });
});

describe('past days are view-only', () => {
  const today = toKey(new Date());
  const yesterday = addDays(today, -1);
  beforeEach(() =>
    useTracker.setState({
      logs: { [yesterday]: day({ groups: ['back'], entries: ['Deadlift'], note: 'Felt strong' }, { items: { bf_eggs: T }, weightKg: 72 }) },
    }),
  );

  it('the store ignores every write to a past day', () => {
    const a = useTracker.getState();
    const before = JSON.stringify(useTracker.getState().logs[yesterday]);
    a.toggleItem(yesterday, 'bf_oats');
    a.setMeal(yesterday, 'lunch', true);
    a.setSupplement(yesterday, 'protein', 2);
    a.addWater(yesterday, 250);
    a.toggleGroup(yesterday, 'leg');
    a.addEntry(yesterday, 'Squat');
    a.setRestDay(yesterday, true);
    a.setWeight(yesterday, 80);
    expect(JSON.stringify(useTracker.getState().logs[yesterday])).toBe(before);
  });

  it('shows the past day read-only in the UI', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Previous day'));
    expect(screen.getByLabelText('Past day, view only')).toBeTruthy();
    const check = screen.getByLabelText('Mark Breakfast done');
    expect(check.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(check);
    expect(Object.keys(useTracker.getState().logs[yesterday].items)).toEqual(['bf_eggs']);
    expect(screen.queryByLabelText('Add 250 ml water')).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: /^Exercise/ }));
    expect(screen.getByText('Deadlift')).toBeTruthy();
    expect(screen.getByText('Felt strong')).toBeTruthy();
    expect(screen.queryByLabelText('Remove Deadlift')).toBeNull();
    expect(screen.queryByLabelText('Increase weight by 0.1 kg')).toBeNull();
  });
});
