import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealCard } from '@/src/components/MealCard';
import { ProgressRing } from '@/src/components/ProgressRing';
import { SupplementRow } from '@/src/components/SupplementRow';
import { WorkoutLogger } from '@/src/components/WorkoutLogger';
import { Bar, GradientButton, Icon, RoundIconButton, ScreenTitle, SectionLabel, Segmented, styles as ui } from '@/src/components/ui';
import {
  MEALS,
  SUPPLEMENTS,
  USER_NAME,
  WATER_STEP_ML,
  WATER_TARGET_ML,
  WORKOUT_MEAL_ID,
  isWorkoutLogged,
  workoutSummary,
} from '@/src/data/plan';
import { useNow } from '@/src/hooks/useNow';
import { addDays, atTime, formatDayLabel, formatTime, fromKey, toKey } from '@/src/lib/date';
import { dayCompletion, type DayResult, type MealResult } from '@/src/lib/insights';
import { emptyDay } from '@/src/lib/types';
import { useTracker } from '@/src/store/useTracker';
import { radius, theme as t } from '@/src/theme';

type Tab = 'diet' | 'supps' | 'exercise';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const today = toKey(now);
  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('diet');
  const params = useLocalSearchParams<{ tab?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const tabsY = useRef(0);

  // Notification taps deep-link here with ?tab=exercise: switch once per param change, then clear it.
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (params.tab === 'exercise' || params.tab === 'supps' || params.tab === 'diet') {
      setTab(params.tab);
      setPicked(null);
    }
  }
  useEffect(() => {
    if (params.tab) router.setParams({ tab: undefined });
  }, [params.tab]);
  // Never sit on a future day (e.g. after midnight, "picked" may equal the old today).
  const day = picked && picked < today ? picked : today;
  const isToday = day === today;

  const log = useTracker((s) => s.logs[day]) ?? emptyDay();
  const suppTimes = useTracker((s) => s.settings.suppTimes);
  const { toggleItem, setMeal, setSupplement, addWater } = useTracker.getState();

  const result = dayCompletion(day, log, now, suppTimes);
  const lastDue = [...result.meals].reverse().find((m) => m.due);
  const nextUp = result.meals.find((m) => m.status === 'upcoming');
  const focus: { meal: MealResult; dueNow: boolean } | null =
    lastDue && lastDue.status !== 'done' ? { meal: lastDue, dueNow: true } : nextUp ? { meal: nextUp, dueNow: false } : null;

  const openWorkout = () => {
    Haptics.selectionAsync();
    setTab('exercise');
    scrollRef.current?.scrollTo({ y: Math.max(0, tabsY.current - 12), animated: true });
  };

  const go = (delta: number) => {
    const next = addDays(day, delta);
    setPicked(next >= today ? null : next);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <ScreenTitle
        eyebrow={fromKey(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
        title={isToday ? `${greeting(now)}${USER_NAME ? `, ${USER_NAME}` : ''}` : formatDayLabel(day, today)}
        right={
          <View style={s.nav}>
            <RoundIconButton icon="chevron.left" label="Previous day" onPress={() => go(-1)} disabled={day <= addDays(today, -60)} />
            <RoundIconButton icon="chevron.right" label="Next day" onPress={() => go(1)} disabled={isToday} />
          </View>
        }
      />
      {!isToday ? (
        <View style={s.pastRow}>
          <View style={s.viewOnly} accessibilityLabel="Past day, view only">
            <Icon name="lock.fill" size={11} color={t.sub} />
            <Text style={s.viewOnlyText}>View only</Text>
          </View>
          <Pressable onPress={() => setPicked(null)} style={s.backToday} accessibilityRole="button">
            <Icon name="arrow.uturn.backward" size={12} color={t.accent} />
            <Text style={s.backTodayText}>Back to today</Text>
          </Pressable>
        </View>
      ) : null}

      <Hero result={result} waterMl={log.waterMl} />

      {isToday && focus ? (
        <UpNext
          meal={focus.meal}
          dueNow={focus.dueNow}
          now={now}
          day={day}
          onDone={() => {
            if (focus.meal.meal.id === WORKOUT_MEAL_ID) return openWorkout();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMeal(day, focus.meal.meal.id, true);
          }}
        />
      ) : null}

      <View style={{ marginTop: 8 }} onLayout={(e) => (tabsY.current = e.nativeEvent.layout.y)}>
        <Segmented<Tab>
          value={tab}
          onChange={(k) => {
            Haptics.selectionAsync();
            setTab(k);
          }}
          options={[
            { key: 'diet', label: 'Diet', badge: `${result.mealsDone}/${MEALS.length}` },
            { key: 'supps', label: 'Supplements', badge: `${result.suppsTaken}/${SUPPLEMENTS.length}` },
            { key: 'exercise', label: 'Exercise', badge: isWorkoutLogged(log) ? '✓' : undefined },
          ]}
        />
      </View>

      {tab === 'diet' ? (
        <>
          <SectionLabel right={<Text style={s.sectionHint}>Lean bulk plan</Text>}>Meal timeline</SectionLabel>
          {result.meals.map((m, i) => (
            <MealCard
              key={`${day}_${m.meal.id}`}
              result={m}
              ticked={log.items}
              initiallyOpen={isToday && m.meal.id === focus?.meal.meal.id}
              isNext={isToday && m.meal.id === focus?.meal.meal.id}
              isLast={i === result.meals.length - 1}
              onToggleMeal={(done) => setMeal(day, m.meal.id, done)}
              onToggleItem={(id) => toggleItem(day, id)}
              workout={m.meal.id === WORKOUT_MEAL_ID ? { summary: workoutSummary(log), onOpen: openWorkout } : undefined}
              readOnly={!isToday}
            />
          ))}
          <SectionLabel>Hydration</SectionLabel>
          <WaterCard ml={log.waterMl} onChange={(delta) => addWater(day, delta)} readOnly={!isToday} />
        </>
      ) : null}

      {tab === 'supps' ? (
        <>
          <SectionLabel right={isToday ? <Text style={s.sectionHint}>Tap the dose you took</Text> : undefined}>Supplements</SectionLabel>
          {result.supplements.map((sr) => (
            <SupplementRow key={sr.supp.id} result={sr} onSet={(amount) => setSupplement(day, sr.supp.id, amount)} readOnly={!isToday} />
          ))}
        </>
      ) : null}

      {tab === 'exercise' ? <WorkoutLogger key={day} day={day} today={today} /> : null}
    </ScrollView>
  );
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Hero({ result, waterMl }: { result: DayResult; waterMl: number }) {
  // Whole-day progress: every meal (by fraction of items) + every supplement.
  const total = MEALS.length + SUPPLEMENTS.length;
  const score = result.meals.reduce((a, m) => a + m.fraction, 0) + result.suppsTaken;
  const pct = Math.round((score / total) * 100);

  return (
    <LinearGradient colors={['#1D2410', t.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <ProgressRing size={136} stroke={14} progress={score / total} label={`${pct}% of today's plan`}>
        <Text style={s.heroPct}>
          {pct}
          <Text style={s.heroPctSign}>%</Text>
        </Text>
        <Text style={s.heroCaption}>of plan</Text>
      </ProgressRing>
      <View style={s.heroStats}>
        <HeroStat icon="fork.knife" color={t.accent} label="Meals" value={`${result.mealsDone}/${MEALS.length}`} progress={result.mealsDone / MEALS.length} />
        <HeroStat icon="pills.fill" color={t.supp} label="Supplements" value={`${result.suppsTaken}/${SUPPLEMENTS.length}`} progress={result.suppsTaken / SUPPLEMENTS.length} />
        <HeroStat icon="drop.fill" color={t.water} label="Water" value={`${waterMl / 1000} L`} progress={waterMl / WATER_TARGET_ML} />
      </View>
    </LinearGradient>
  );
}

function HeroStat({ icon, color, label, value, progress }: { icon: string; color: string; label: string; value: string; progress: number }) {
  return (
    <View>
      <View style={s.heroStatTop}>
        <Icon name={icon} size={12} color={color} />
        <Text style={s.heroStatLabel}>{label}</Text>
        <Text style={s.heroStatValue}>{value}</Text>
      </View>
      <Bar value={progress} color={color} height={6} />
    </View>
  );
}

function UpNext({ meal, dueNow, now, day, onDone }: { meal: MealResult; dueNow: boolean; now: Date; day: string; onDone: () => void }) {
  const mins = Math.round((atTime(day, meal.meal.time).getTime() - now.getTime()) / 60000);
  const when = dueNow ? 'Due now' : mins < 60 ? `In ${mins} min` : `In ${Math.floor(mins / 60)}h ${mins % 60}m`;
  const pending = meal.meal.items.filter((i) => meal.missingItems.includes(i.id));

  return (
    <View style={[ui.card, s.upNext]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.upNextEyebrow, { color: dueNow ? t.partial : t.accent }]}>
          {dueNow ? '● ' : ''}
          {when} · {formatTime(meal.meal.time)}
        </Text>
        <Text style={s.upNextTitle}>{meal.meal.title}</Text>
        <Text style={s.upNextItems} numberOfLines={2}>
          {pending.map((i) => i.name).join(' · ')}
        </Text>
      </View>
      {meal.meal.id === WORKOUT_MEAL_ID ? (
        <GradientButton label="Log" icon="square.and.pencil" onPress={onDone} />
      ) : (
        <GradientButton label="Done" icon="checkmark" onPress={onDone} />
      )}
    </View>
  );
}

const DROPS = WATER_TARGET_ML / WATER_STEP_ML;

function WaterCard({ ml, onChange, readOnly }: { ml: number; onChange: (delta: number) => void; readOnly?: boolean }) {
  const filled = Math.floor(ml / WATER_STEP_ML);
  const tap = (i: number) => {
    Haptics.selectionAsync();
    // Tapping the top filled drop empties it; any other drop fills up to it.
    const target = i + 1 === filled ? i * WATER_STEP_ML : (i + 1) * WATER_STEP_ML;
    onChange(target - ml);
  };
  return (
    <View style={ui.card}>
      <View style={s.waterTop}>
        <View>
          <Text style={s.waterValue}>
            {ml / 1000}
            <Text style={s.waterUnit}> L</Text>
          </Text>
          <Text style={s.waterSub}>Goal 3–3.5 L</Text>
        </View>
        {!readOnly ? (
          <View style={s.nav}>
            <RoundIconButton icon="minus" label="Remove 250 ml water" color={t.water} onPress={() => onChange(-WATER_STEP_ML)} disabled={ml === 0} />
            <RoundIconButton icon="plus" label="Add 250 ml water" color={t.water} onPress={() => onChange(WATER_STEP_ML)} />
          </View>
        ) : null}
      </View>
      <View style={s.drops}>
        {Array.from({ length: DROPS }, (_, i) => (
          <Pressable key={i} onPress={() => tap(i)} disabled={readOnly} hitSlop={4} accessibilityLabel={`Set water to ${((i + 1) * WATER_STEP_ML) / 1000} litres`} style={s.drop}>
            <Icon name={i < filled ? 'drop.fill' : 'drop'} size={22} color={i < filled ? t.water : t.muted} />
          </Pressable>
        ))}
      </View>
      {!readOnly ? <Text style={s.waterHint}>Each drop = 250 ml glass</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  nav: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 14 },
  viewOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: t.raised,
  },
  viewOnlyText: { color: t.sub, fontWeight: '700', fontSize: 13 },
  backToday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: t.accent + '1A',
  },
  backTodayText: { color: t.accent, fontWeight: '700', fontSize: 13 },
  sectionHint: { color: t.muted, fontSize: 12, fontWeight: '600' },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.accent + '26',
  },
  heroPct: { color: t.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  heroPctSign: { fontSize: 18, fontWeight: '800', color: t.sub },
  heroCaption: { color: t.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: -2 },
  heroStats: { flex: 1, gap: 14 },
  heroStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  heroStatLabel: { flex: 1, color: t.sub, fontSize: 12, fontWeight: '700' },
  heroStatValue: { color: t.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  upNext: { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: t.accent + '40' },
  upNextEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  upNextTitle: { color: t.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  upNextItems: { color: t.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },

  waterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waterValue: { color: t.text, fontSize: 30, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  waterUnit: { fontSize: 16, color: t.sub, fontWeight: '800' },
  waterSub: { color: t.sub, fontSize: 12, fontWeight: '600' },
  drops: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 6 },
  drop: { width: `${100 / 6}%`, alignItems: 'center', paddingVertical: 4 },
  waterHint: { color: t.muted, fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },

});
