import * as Notifications from 'expo-notifications';

import {
  MEALS,
  MUSCLE_GROUPS,
  SUMMARY_TIME,
  SUPPLEMENTS,
  WORKOUT_LOG_TIME,
  WORKOUT_MEAL_ID,
  formatDose,
  isItemDone,
  isWorkoutLogged,
  requiredItems,
} from '../data/plan';
import { addDays, atTime, formatTime, toKey, type DateKey } from './date';
import { dayCompletion } from './insights';
import type { Logs, Settings } from './types';

/** How many days ahead reminders are scheduled; refreshed every time the app opens. */
export const SCHEDULE_DAYS = 5;
/** iOS keeps at most 64 pending local notifications per app (~12 per day here). */
const MAX_PENDING = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

type Req = { id: string; date: Date; title: string; body: string; url: string };

/** Reminder slot id (in settings.slotEnabled) for "log today's workout". */
export const WORKOUT_LOG_SLOT = 'workoutLog';
const EXERCISE_URL = '/?tab=exercise';

function shortList(names: string[], max = 4) {
  return names.length > max ? `${names.slice(0, max).join(', ')} +${names.length - max} more` : names.join(', ');
}

/** Build every reminder for one day, skipping slots already logged. */
function dayRequests(day: DateKey, logs: Logs, settings: Settings, now: Date, isLastDay: boolean): Req[] {
  const log = logs[day];
  const groups = new Map<string, { titles: string[]; lines: string[]; url: string }>();
  const group = (time: string) => {
    if (!groups.has(time)) groups.set(time, { titles: [], lines: [], url: '/' });
    return groups.get(time)!;
  };

  for (const meal of MEALS) {
    if (settings.slotEnabled[meal.id] === false) continue;
    const pending = requiredItems(meal).filter((i) => !isItemDone(log, i.id));
    if (pending.length === 0) continue;
    const g = group(meal.time);
    if (meal.id === WORKOUT_MEAL_ID) g.url = EXERCISE_URL;
    g.titles.push(meal.title);
    g.lines.push(shortList(pending.map((i) => `${i.name} ${i.qty}`)));
  }
  for (const supp of SUPPLEMENTS) {
    if (settings.slotEnabled[supp.id] === false || log?.supplements[supp.id]) continue;
    const g = group(settings.suppTimes[supp.id] ?? supp.defaultTime);
    const dose = supp.doses.length > 1
      ? `${supp.doses[0]}–${formatDose(supp.doses[supp.doses.length - 1], supp.unit)}`
      : formatDose(supp.doses[0], supp.unit);
    g.titles.push(supp.name);
    g.lines.push(`${supp.name} ${dose}`);
  }
  if (settings.slotEnabled[WORKOUT_LOG_SLOT] !== false && !isWorkoutLogged(log)) {
    const g = group(settings.workoutLogTime ?? WORKOUT_LOG_TIME);
    g.titles.push("Log today's workout");
    g.lines.push(`What did you train? ${MUSCLE_GROUPS.slice(0, 4).map((m) => m.label).join(', ')}… or mark a rest day.`);
    g.url = EXERCISE_URL;
  }

  const out: Req[] = [];
  for (const [time, g] of groups) {
    out.push({
      id: `${day}_${time}`,
      date: atTime(day, time),
      title: `${g.titles.join(' + ')} · ${formatTime(time)}`,
      body: g.lines.join('\n'),
      url: g.url,
    });
  }

  if (settings.summaryOn) {
    let body: string;
    if (day === toKey(now)) {
      const r = dayCompletion(day, log, atTime(day, SUMMARY_TIME), settings.suppTimes);
      body = `So far: ${r.mealsDone}/${MEALS.length} meals, ${r.suppsTaken}/${SUPPLEMENTS.length} supplements. Tap to review what you missed.`;
    } else {
      body = 'Log anything you ate and see what you missed today.';
    }
    if (isLastDay) body += ' Open the app to keep reminders coming.';
    out.push({ id: `${day}_summary`, date: atTime(day, SUMMARY_TIME), title: 'Daily check-in', body, url: '/insights' });
  }
  return out;
}

export function buildSchedule(logs: Logs, settings: Settings, now = new Date()): Req[] {
  if (!settings.remindersOn) return [];
  const today = toKey(now);
  const all: Req[] = [];
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const day = addDays(today, i);
    all.push(...dayRequests(day, logs, settings, now, i === SCHEDULE_DAYS - 1));
  }
  return all
    .filter((r) => r.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_PENDING);
}

let syncing: Promise<void> = Promise.resolve();

/** Replace all pending reminders with a fresh schedule. Calls are serialized. */
export function syncNotifications(logs: Logs, settings: Settings): Promise<void> {
  syncing = syncing
    .catch(() => {})
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const r of buildSchedule(logs, settings)) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body, data: { url: r.url }, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
        });
      }
    });
  return syncing;
}

export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Reminders are working', body: 'You will get a nudge at each meal and supplement time.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}

export async function pendingCount() {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
