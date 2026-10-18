import type { DateKey } from './date';

export type Intensity = 'easy' | 'moderate' | 'hard';

export type WorkoutLog = {
  /** Muscle-group ids (see MUSCLE_GROUPS). */
  groups: string[];
  /** Free-text exercises, e.g. "Hammer curl 3x12", "Cycling 15 min". */
  entries: string[];
  note?: string;
  minutes?: number;
  intensity?: Intensity;
  /** Rest day: counts as done, never as missed. */
  rest?: boolean;
  /** Last edit (ISO). */
  at: string;
};

export type DayLog = {
  /** itemId -> ticked time (ISO). Present = eaten. */
  items: Record<string, string>;
  /** supplementId -> amount taken + time. */
  supplements: Record<string, { amount: number; at: string }>;
  waterMl: number;
  workout?: WorkoutLog;
  weightKg?: number;
};

export type Logs = Record<DateKey, DayLog>;

export type Settings = {
  remindersOn: boolean;
  /** Reminder on/off per meal id / supplement id. Missing = on. */
  slotEnabled: Record<string, boolean>;
  /** supplementId -> "HH:MM" */
  suppTimes: Record<string, string>;
  summaryOn: boolean;
  /** "HH:MM" for the "log today's workout" reminder. */
  workoutLogTime: string;
};

export const emptyDay = (): DayLog => ({ items: {}, supplements: {}, waterMl: 0 });

export const emptyWorkout = (): WorkoutLog => ({ groups: [], entries: [], at: new Date().toISOString() });
