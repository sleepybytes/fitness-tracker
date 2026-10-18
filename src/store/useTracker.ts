import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MEALS, SUPPLEMENTS, WORKOUT_ITEM_ID, WORKOUT_LOG_TIME, requiredItems } from '../data/plan';
import { toKey, type DateKey } from '../lib/date';
import { emptyDay, emptyWorkout, type DayLog, type Intensity, type Logs, type Settings, type WorkoutLog } from '../lib/types';

type TrackerState = {
  logs: Logs;
  settings: Settings;
  /** First day the app was used; earlier days are never reported as missed. */
  startDate: DateKey;

  toggleItem: (day: DateKey, itemId: string) => void;
  /** Tick or untick every required item of a meal. */
  setMeal: (day: DateKey, mealId: string, done: boolean) => void;
  /** null clears the entry. */
  setSupplement: (day: DateKey, suppId: string, amount: number | null) => void;
  addWater: (day: DateKey, deltaMl: number) => void;

  toggleGroup: (day: DateKey, groupId: string) => void;
  addEntry: (day: DateKey, text: string) => void;
  removeEntry: (day: DateKey, index: number) => void;
  setWorkoutNote: (day: DateKey, note: string) => void;
  /** null clears it. */
  setWorkoutMinutes: (day: DateKey, minutes: number | null) => void;
  setIntensity: (day: DateKey, intensity: Intensity | null) => void;
  setRestDay: (day: DateKey, rest: boolean) => void;
  /** null clears it. */
  setWeight: (day: DateKey, kg: number | null) => void;

  setRemindersOn: (on: boolean) => void;
  setSummaryOn: (on: boolean) => void;
  setSlotEnabled: (slotId: string, on: boolean) => void;
  setSuppTime: (suppId: string, hhmm: string) => void;
  setWorkoutLogTime: (hhmm: string) => void;
  resetAll: () => void;
};

const defaultSettings = (): Settings => ({
  remindersOn: true,
  summaryOn: true,
  slotEnabled: {},
  suppTimes: Object.fromEntries(SUPPLEMENTS.map((s) => [s.id, s.defaultTime])),
  workoutLogTime: WORKOUT_LOG_TIME,
});

type Persisted = Pick<TrackerState, 'logs' | 'settings' | 'startDate'>;

/** v1 → v2: a ticked diet-plan "Workout" becomes a (bare) workout log; new settings get defaults. */
export function migrate(persisted: unknown, version: number): Persisted {
  const state = persisted as Persisted;
  if (version < 2) {
    const logs: Logs = {};
    for (const [key, day] of Object.entries(state.logs ?? {})) {
      const { [WORKOUT_ITEM_ID]: tickedAt, ...items } = day.items ?? {};
      logs[key] = tickedAt && !day.workout ? { ...day, items, workout: { ...emptyWorkout(), entries: ['Strength training'], at: tickedAt } } : { ...day, items };
    }
    state.logs = logs;
  }
  state.settings = { ...defaultSettings(), ...state.settings };
  return state;
}

export const useTracker = create<TrackerState>()(
  persist(
    (set) => {
      // Past days are view-only: only today's log can change.
      const updateDay = (day: DateKey, fn: (d: DayLog) => DayLog) => {
        if (day !== toKey(new Date())) return;
        set((s) => ({ logs: { ...s.logs, [day]: fn(s.logs[day] ?? emptyDay()) } }));
      };
      const updateWorkout = (day: DateKey, fn: (w: WorkoutLog) => WorkoutLog) =>
        updateDay(day, (d) => ({ ...d, workout: { ...fn(d.workout ?? emptyWorkout()), at: new Date().toISOString() } }));

      return {
        logs: {},
        settings: defaultSettings(),
        startDate: toKey(new Date()),

        toggleItem: (day, itemId) =>
          updateDay(day, (d) => {
            const items = { ...d.items };
            if (items[itemId]) delete items[itemId];
            else items[itemId] = new Date().toISOString();
            return { ...d, items };
          }),

        setMeal: (day, mealId, done) =>
          updateDay(day, (d) => {
            const meal = MEALS.find((m) => m.id === mealId);
            if (!meal) return d;
            const items = { ...d.items };
            const now = new Date().toISOString();
            for (const item of done ? requiredItems(meal) : meal.items) {
              if (done) items[item.id] ??= now;
              else delete items[item.id];
            }
            return { ...d, items };
          }),

        setSupplement: (day, suppId, amount) =>
          updateDay(day, (d) => {
            const supplements = { ...d.supplements };
            if (amount === null) delete supplements[suppId];
            else supplements[suppId] = { amount, at: new Date().toISOString() };
            return { ...d, supplements };
          }),

        addWater: (day, deltaMl) => updateDay(day, (d) => ({ ...d, waterMl: Math.max(0, d.waterMl + deltaMl) })),

        toggleGroup: (day, groupId) =>
          updateWorkout(day, (w) => ({
            ...w,
            groups: w.groups.includes(groupId) ? w.groups.filter((g) => g !== groupId) : [...w.groups, groupId],
          })),
        addEntry: (day, text) => {
          const entry = text.trim();
          if (entry) updateWorkout(day, (w) => (w.entries.includes(entry) ? w : { ...w, entries: [...w.entries, entry] }));
        },
        removeEntry: (day, index) => updateWorkout(day, (w) => ({ ...w, entries: w.entries.filter((_, i) => i !== index) })),
        setWorkoutNote: (day, note) => updateWorkout(day, (w) => ({ ...w, note: note || undefined })),
        setWorkoutMinutes: (day, minutes) => updateWorkout(day, (w) => ({ ...w, minutes: minutes ?? undefined })),
        setIntensity: (day, intensity) => updateWorkout(day, (w) => ({ ...w, intensity: intensity ?? undefined })),
        setRestDay: (day, rest) => updateWorkout(day, (w) => ({ ...w, rest: rest || undefined })),
        setWeight: (day, kg) =>
          updateDay(day, (d) => {
            const next = { ...d };
            if (kg === null || !Number.isFinite(kg) || kg <= 0) delete next.weightKg;
            else next.weightKg = Math.round(kg * 10) / 10;
            return next;
          }),

        setRemindersOn: (on) => set((s) => ({ settings: { ...s.settings, remindersOn: on } })),
        setSummaryOn: (on) => set((s) => ({ settings: { ...s.settings, summaryOn: on } })),
        setSlotEnabled: (slotId, on) =>
          set((s) => ({ settings: { ...s.settings, slotEnabled: { ...s.settings.slotEnabled, [slotId]: on } } })),
        setSuppTime: (suppId, hhmm) =>
          set((s) => ({ settings: { ...s.settings, suppTimes: { ...s.settings.suppTimes, [suppId]: hhmm } } })),
        setWorkoutLogTime: (hhmm) => set((s) => ({ settings: { ...s.settings, workoutLogTime: hhmm } })),
        resetAll: () => set({ logs: {}, settings: defaultSettings(), startDate: toKey(new Date()) }),
      };
    },
    {
      name: 'fitness-tracker',
      version: 2,
      migrate,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ logs, settings, startDate }) => ({ logs, settings, startDate }),
    },
  ),
);
