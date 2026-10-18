// Muscle-gain / lean-bulk diet plan from a personal trainer.
// This file is the single source of truth for what the app tracks each day.

import type { DayLog } from '../lib/types';

/** Optional name for the greeting; set EXPO_PUBLIC_USER_NAME in .env.local. */
export const USER_NAME = process.env.EXPO_PUBLIC_USER_NAME?.trim() || '';

export type PlanItem = {
  id: string;
  name: string;
  qty: string;
  /** Optional items (e.g. "if hungry") never count as missed. */
  optional?: boolean;
};

export type Meal = {
  id: string;
  /** 24h "HH:MM" */
  time: string;
  title: string;
  items: PlanItem[];
  note?: string;
};

export type Supplement = {
  id: string;
  name: string;
  doses: number[];
  unit: 'scoop' | 'tab';
  /** Default reminder time, 24h "HH:MM". Editable in settings. */
  defaultTime: string;
};

export const MEALS: Meal[] = [
  {
    id: 'waking',
    time: '07:00',
    title: 'Upon waking',
    items: [
      { id: 'waking_water', name: 'Warm water', qty: '1 cup' },
      { id: 'waking_almonds', name: 'Soaked almonds', qty: '5' },
      { id: 'waking_dryfruits', name: 'Mixed dry fruits', qty: '10 g' },
    ],
  },
  {
    id: 'breakfast',
    time: '08:00',
    title: 'Breakfast',
    note: 'Make a 5-egg omelette. Cook oats with milk and add banana, apple and dry fruits.',
    items: [
      { id: 'bf_eggs', name: 'Whole eggs', qty: '5' },
      { id: 'bf_oats', name: 'Oats', qty: '50 g' },
      { id: 'bf_milk', name: 'Full-fat milk', qty: '200 ml' },
      { id: 'bf_banana', name: 'Banana', qty: '1 medium' },
      { id: 'bf_apple', name: 'Apple', qty: '½–1' },
      { id: 'bf_dryfruits', name: 'Mixed dry fruits', qty: '10 g' },
    ],
  },
  {
    id: 'shake',
    time: '11:00',
    title: 'High-calorie shake',
    note: 'Blend everything together.',
    items: [
      { id: 'shake_milk', name: 'Full-fat milk', qty: '250 ml' },
      { id: 'shake_banana', name: 'Banana', qty: '1' },
      { id: 'shake_peanuts', name: 'Peanuts', qty: '20 g' },
      { id: 'shake_dryfruits', name: 'Mixed dry fruits', qty: '15 g' },
      { id: 'shake_oats', name: 'Oats', qty: '20 g' },
    ],
  },
  {
    id: 'lunch',
    time: '13:30',
    title: 'Lunch',
    items: [
      { id: 'lunch_roti', name: 'Roti', qty: '4 medium' },
      { id: 'lunch_chicken', name: 'Grilled/air-fried chicken', qty: '200 g cooked' },
      { id: 'lunch_salad', name: 'Salad (cucumber, carrot, tomato, onion)', qty: '1 bowl' },
      { id: 'lunch_buttermilk', name: 'Buttermilk', qty: '250 ml' },
      { id: 'lunch_ghee', name: 'Ghee', qty: '1 tsp' },
    ],
  },
  {
    id: 'hydration',
    time: '15:30',
    title: 'Hydration',
    items: [
      { id: 'hyd_coconut', name: 'Coconut water', qty: '1 glass' },
      { id: 'hyd_banana', name: 'Small banana (if hungry)', qty: '1', optional: true },
    ],
  },
  {
    id: 'preworkout',
    time: '16:30',
    title: 'Pre-workout meal',
    items: [
      { id: 'pre_curd', name: 'Curd/yoghurt', qty: '150 g' },
      { id: 'pre_banana', name: 'Banana', qty: '1' },
      { id: 'pre_pomegranate', name: 'Pomegranate', qty: '½ cup' },
      { id: 'pre_sprouts', name: 'Sprouts', qty: '50 g' },
      { id: 'pre_honey', name: 'Honey', qty: '1 tsp' },
    ],
  },
  {
    id: 'workout',
    time: '18:00',
    title: 'Workout',
    note: 'Strength training. Drink water throughout the workout.',
    items: [{ id: 'workout_done', name: 'Strength training', qty: 'session' }],
  },
  {
    id: 'dinner',
    time: '20:00',
    title: 'Post-workout dinner',
    items: [
      { id: 'dinner_roti', name: 'Roti', qty: '5 medium' },
      { id: 'dinner_chicken', name: 'Grilled/air-fried chicken', qty: '200 g cooked' },
      { id: 'dinner_veg', name: 'Cooked vegetables', qty: '1 serving' },
      { id: 'dinner_curd', name: 'Curd', qty: '100 g' },
    ],
  },
  {
    id: 'bed',
    time: '22:00',
    title: 'Before bed',
    items: [
      { id: 'bed_milk', name: 'Full-fat milk', qty: '250 ml' },
      { id: 'bed_almonds', name: 'Almonds', qty: '5–10' },
    ],
  },
];

export const SUPPLEMENTS: Supplement[] = [
  { id: 'multivitamin', name: 'Multivitamin', doses: [1, 2, 3], unit: 'tab', defaultTime: '08:00' },
  { id: 'omega3', name: 'Omega-3 oil', doses: [1], unit: 'tab', defaultTime: '13:30' },
  { id: 'protein', name: 'Protein powder', doses: [1, 2], unit: 'scoop', defaultTime: '19:30' },
];

/** The diet-plan "Workout" slot; its done state comes from the workout log, not a tick. */
export const WORKOUT_MEAL_ID = 'workout';
export const WORKOUT_ITEM_ID = 'workout_done';

export type MuscleGroup = { id: string; label: string; icon: string };

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: 'back', label: 'Back', icon: 'figure.rower' },
  { id: 'shoulder', label: 'Shoulder', icon: 'figure.arms.open' },
  { id: 'neck', label: 'Neck', icon: 'person.bust' },
  { id: 'biceps', label: 'Biceps', icon: 'dumbbell.fill' },
  { id: 'triceps', label: 'Triceps', icon: 'figure.strengthtraining.functional' },
  { id: 'forearms', label: 'Forearms', icon: 'hand.raised.fill' },
  { id: 'leg', label: 'Leg', icon: 'figure.step.training' },
  { id: 'hiit', label: 'HIIT', icon: 'bolt.heart.fill' },
  { id: 'cardio', label: 'Cardio', icon: 'figure.run' },
];

export const WORKOUT_LOG_TIME = '19:00';
export const DURATION_CHOICES = [15, 30, 45, 60, 75, 90];

export const WATER_TARGET_ML = 3000;
export const WATER_STEP_ML = 250;

export const SUMMARY_TIME = '22:30';

const itemIndex = new Map<string, { item: PlanItem; meal: Meal }>();
for (const meal of MEALS) for (const item of meal.items) itemIndex.set(item.id, { item, meal });

export function findItem(id: string) {
  return itemIndex.get(id);
}

export function requiredItems(meal: Meal) {
  return meal.items.filter((i) => !i.optional);
}

export function formatDose(amount: number, unit: Supplement['unit']) {
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

export function groupLabel(id: string) {
  return MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id;
}

/** Something was trained, or the day was marked as rest. */
export function isWorkoutLogged(log: DayLog | undefined) {
  const w = log?.workout;
  return !!w && (!!w.rest || w.groups.length > 0 || w.entries.length > 0);
}

/** Whether a plan item counts as done for the day (the workout item follows the workout log). */
export function isItemDone(log: DayLog | undefined, itemId: string) {
  return itemId === WORKOUT_ITEM_ID ? isWorkoutLogged(log) : !!log?.items[itemId];
}

/** e.g. "Back + Biceps · 45 min", "Rest day", or null when nothing is logged. */
export function workoutSummary(log: DayLog | undefined): string | null {
  const w = log?.workout;
  if (!w || !isWorkoutLogged(log)) return null;
  if (w.rest) return 'Rest day';
  const what = w.groups.length
    ? w.groups.map(groupLabel).join(' + ')
    : `${w.entries.length} exercise${w.entries.length === 1 ? '' : 's'}`;
  return w.minutes ? `${what} · ${w.minutes} min` : what;
}
