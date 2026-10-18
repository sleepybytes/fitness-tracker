import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayBars } from '@/src/components/DayBars';
import { GroupBars } from '@/src/components/GroupBars';
import { Heatmap } from '@/src/components/Heatmap';
import { ProgressRing } from '@/src/components/ProgressRing';
import { WeightLine } from '@/src/components/WeightLine';
import { Bar, Card, Icon, ScreenTitle, SectionLabel, Segmented } from '@/src/components/ui';
import { findItem, formatDose } from '@/src/data/plan';
import { useNow } from '@/src/hooks/useNow';
import { addDays, toKey } from '@/src/lib/date';
import { dayCompletion, rangeReport, streaks } from '@/src/lib/insights';
import { lastTrained, trainingStreak, weightSeries, workoutStats } from '@/src/lib/workoutInsights';
import { useTracker } from '@/src/store/useTracker';
import { theme as t } from '@/src/theme';

type Range = '7' | '30';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const today = toKey(now);
  const [range, setRange] = useState<Range>('7');
  const days = Number(range);

  const logs = useTracker((s) => s.logs);
  const suppTimes = useTracker((s) => s.settings.suppTimes);
  const startDate = useTracker((s) => s.startDate);
  // Backfilled days before first launch still count.
  const start = Object.keys(logs).reduce((min, k) => (k < min ? k : min), startDate);

  const from = addDays(today, -(days - 1));
  const report = useMemo(() => rangeReport(logs, from, today, now, suppTimes, start), [logs, from, today, now, suppTimes, start]);
  const streak = useMemo(() => streaks(logs, now, suppTimes, start), [logs, now, suppTimes, start]);
  const workouts = useMemo(() => workoutStats(logs, from, today, now, start), [logs, from, today, now, start]);
  const trainStreak = useMemo(() => trainingStreak(logs, now, start), [logs, now, start]);
  const dueGroups = useMemo(() => {
    const lt = lastTrained(logs, today);
    // Only nag once something has been trained at all.
    return lt.some((x) => x.days !== null) ? lt.filter((x) => x.days === null || x.days >= 7).slice(0, 4) : [];
  }, [logs, today]);
  const weight = useMemo(() => weightSeries(logs, from, today), [logs, from, today]);
  const todayResult = dayCompletion(today, logs[today], now, suppTimes);

  // The chart always spans the whole range; days before first use show as "no data".
  const chartDays = useMemo(() => {
    const byKey = Object.fromEntries(report.days.map((d) => [d.key, d]));
    return Array.from({ length: days }, (_, i) => {
      const k = addDays(from, i);
      return byKey[k] ?? { ...dayCompletion(k, undefined, now, suppTimes), percent: null };
    });
  }, [report, days, from, now, suppTimes]);

  const missedToday = todayResult.meals
    .filter((m) => m.due && m.status !== 'done')
    .map((m) => ({
      key: m.meal.id,
      title: m.meal.title,
      detail: m.status === 'missed' ? 'Whole meal' : m.missingItems.map((id) => findItem(id)?.item.name).join(', '),
    }));
  const missedSupps = todayResult.supplements.filter((s) => s.missed);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <ScreenTitle eyebrow="Your progress" title="Insights" />

      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { key: '7', label: 'Last 7 days' },
          { key: '30', label: 'Last 30 days' },
        ]}
      />

      <View style={s.hero}>
        <ProgressRing size={120} stroke={13} progress={(report.adherence ?? 0) / 100} label={`Adherence ${report.adherence ?? 0}%`}>
          <Text style={s.heroPct}>{report.adherence === null ? '—' : `${report.adherence}%`}</Text>
          <Text style={s.heroCaption}>Adherence</Text>
        </ProgressRing>
        <View style={s.heroStats}>
          <HeroStat icon="flame.fill" color={t.streak} value={`${streak.current}`} unit={streak.current === 1 ? 'day' : 'days'} label="Current streak" />
          <HeroStat icon="trophy.fill" color={t.partial} value={`${streak.best}`} unit="best" label="Longest streak" />
          <HeroStat icon="star.fill" color={t.accent} value={`${report.perfectDays}`} unit={`of ${report.trackedDays}`} label="Perfect days" />
        </View>
      </View>

      <SectionLabel>Daily completion</SectionLabel>
      <Card>
        {range === '7' ? (
          <DayBars days={chartDays} />
        ) : (
          <Heatmap from={from} count={days} today={today} results={Object.fromEntries(chartDays.map((d) => [d.key, d]))} />
        )}
      </Card>

      <SectionLabel>Today so far</SectionLabel>
      <Card>
        {missedToday.length === 0 && missedSupps.length === 0 ? (
          <View style={s.allGood}>
            <Icon name="checkmark.seal.fill" size={22} color={t.accent} />
            <Text style={s.allGoodText}>{todayResult.mealsDue === 0 ? 'Nothing due yet.' : 'Nothing missed so far. Keep going!'}</Text>
          </View>
        ) : (
          <>
            {missedToday.map((m) => (
              <Row key={m.key} icon="xmark.circle.fill" color={t.missed} title={m.title} detail={m.detail} />
            ))}
            {missedSupps.map((sr) => (
              <Row key={sr.supp.id} icon="pills.fill" color={t.missed} title={sr.supp.name} detail="Not taken" />
            ))}
          </>
        )}
      </Card>

      <SectionLabel>Workouts</SectionLabel>
      <Card>
        <View style={s.miniRow}>
          <MiniStat label="Training days" value={`${workouts.trainingDays}`} sub={`of ${workouts.trackedDays}`} />
          <MiniStat label="Avg session" value={workouts.avgMinutes === null ? '—' : `${workouts.avgMinutes}`} sub={workouts.avgMinutes === null ? '' : 'min'} />
          <MiniStat label="Streak" value={`${trainStreak.current}`} sub={`best ${trainStreak.best}`} />
        </View>
        {workouts.groupCounts.length ? (
          <>
            <Text style={s.subhead}>Muscle groups trained</Text>
            <GroupBars counts={workouts.groupCounts} outOf={workouts.trackedDays} />
          </>
        ) : (
          <Text style={[s.detail, { marginTop: 12 }]}>Log a workout to see which muscle groups you train most.</Text>
        )}
        {workouts.trackedDays > 0 ? (
          <Text style={[s.detail, { marginTop: 10 }]}>
            Rest {workouts.restDays} · Missed {workouts.missedDays}
            {workouts.intensity.hard + workouts.intensity.moderate + workouts.intensity.easy > 0
              ? ` · Hard ${workouts.intensity.hard} · Moderate ${workouts.intensity.moderate} · Easy ${workouts.intensity.easy}`
              : ''}
          </Text>
        ) : null}
      </Card>

      {dueGroups.length ? (
        <>
          <SectionLabel>Due for a session</SectionLabel>
          <Card>
            {dueGroups.map((g) => (
              <Row
                key={g.group.id}
                icon={g.group.icon}
                color={t.partial}
                title={g.group.label}
                detail={g.days === null ? 'Not trained yet' : `Last trained ${g.days} days ago`}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel
        right={
          weight.change !== null ? (
            <Text style={s.detail}>
              {weight.change >= 0 ? '+' : ''}
              {weight.change} kg in {days} days
            </Text>
          ) : undefined
        }>
        Body weight
      </SectionLabel>
      <Card>
        {weight.points.length ? (
          <WeightLine points={weight.points} from={from} to={today} />
        ) : (
          <Text style={s.detail}>Log your weight in the Exercise tab to see the trend.</Text>
        )}
      </Card>

      {report.trackedDays === 0 ? (
        <Card>
          <Text style={{ color: t.sub }}>Not enough data yet. Log a day and come back.</Text>
        </Card>
      ) : (
        <>
          <SectionLabel>Most missed meals</SectionLabel>
          <Card>
            {report.mealMisses.length === 0 ? (
              <View style={s.allGood}>
                <Icon name="checkmark.seal.fill" size={22} color={t.accent} />
                <Text style={s.allGoodText}>No missed meals in this period.</Text>
              </View>
            ) : (
              report.mealMisses.slice(0, 5).map((m) => (
                <Meter
                  key={m.meal.id}
                  title={m.meal.title}
                  detail={`missed ${m.missed}${m.partial ? ` · partial ${m.partial}` : ''} of ${m.dueDays} days`}
                  value={(m.missed + m.partial * 0.5) / m.dueDays}
                  color={t.missed}
                />
              ))
            )}
          </Card>

          {report.itemMisses.length > 0 ? (
            <>
              <SectionLabel>Most skipped foods</SectionLabel>
              <Card>
                {report.itemMisses.slice(0, 6).map((c) => {
                  const found = findItem(c.itemId);
                  return (
                    <Row
                      key={c.itemId}
                      icon="minus.circle.fill"
                      color={c.missedDays / c.dueDays >= 0.5 ? t.missed : t.partial}
                      title={`${found?.item.name} (${found?.item.qty})`}
                      detail={`${found?.meal.title} · missed ${c.missedDays} of ${c.dueDays} days`}
                    />
                  );
                })}
              </Card>
            </>
          ) : null}

          <SectionLabel>Supplements</SectionLabel>
          <Card>
            {report.supplements.map((st) => (
              <Meter
                key={st.supp.id}
                title={st.supp.name}
                detail={`${st.takenDays}/${st.dueDays} days${st.avgDose !== null ? ` · avg ${formatDose(st.avgDose, st.supp.unit)}` : ''}`}
                value={st.dueDays ? st.takenDays / st.dueDays : 0}
                color={t.supp}
              />
            ))}
          </Card>

          <SectionLabel>Nutrition · daily average</SectionLabel>
          <Card>
            <Macro label="Protein" unit="g" planned={report.avgPlanned.protein} eaten={report.avgEaten.protein} />
            <Macro label="Calories" unit="kcal" planned={report.avgPlanned.kcal} eaten={report.avgEaten.kcal} />
            {report.avgWaterMl !== null ? (
              <View style={s.waterRow}>
                <Icon name="drop.fill" size={13} color={t.water} />
                <Text style={s.detail}>
                  Water {(report.avgWaterMl / 1000).toFixed(1)} L/day · target 3–3.5 L
                </Text>
              </View>
            ) : null}
            <Text style={s.footnote}>Estimates from typical values for each portion in your plan. Covers meals that were due.</Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function HeroStat({ icon, color, value, unit, label }: { icon: string; color: string; value: string; unit: string; label: string }) {
  return (
    <View style={s.heroStat} accessibilityLabel={`${label}: ${value} ${unit}`}>
      <View style={[s.heroStatIcon, { backgroundColor: color + '1F' }]}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <View>
        <Text style={s.heroStatValue}>
          {value} <Text style={s.heroStatUnit}>{unit}</Text>
        </Text>
        <Text style={s.heroStatLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={s.mini}>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={s.miniValue}>
        {value} <Text style={s.miniSub}>{sub}</Text>
      </Text>
    </View>
  );
}

function Row({ icon, color, title, detail }: { icon: string; color: string; title: string; detail: string }) {
  return (
    <View style={s.row}>
      <Icon name={icon} size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.detail}>{detail}</Text>
      </View>
    </View>
  );
}

function Meter({ title, detail, value, color }: { title: string; detail: string; value: number; color: string }) {
  return (
    <View style={s.meter}>
      <View style={s.meterTop}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.detail}>{detail}</Text>
      </View>
      <Bar value={value} color={color} />
    </View>
  );
}

function Macro({ label, unit, planned, eaten }: { label: string; unit: string; planned: number; eaten: number }) {
  const short = Math.max(0, planned - eaten);
  return (
    <View style={s.meter}>
      <View style={s.meterTop}>
        <Text style={s.title}>{label}</Text>
        <Text style={s.detail}>
          <Text style={s.macroValue}>{eaten}</Text> / {planned} {unit}
        </Text>
      </View>
      <Bar value={planned ? eaten / planned : 0} color={t.accent} height={10} />
      {short > 0 ? (
        <View style={s.short}>
          <Icon name="arrow.down.right" size={10} color={t.missed} />
          <Text style={s.detail}>
            {short} {unit} short of plan
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 18,
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: t.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
  },
  heroPct: { color: t.text, fontSize: 28, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroCaption: { color: t.sub, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  heroStats: { flex: 1, gap: 12 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroStatValue: { color: t.text, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  heroStatUnit: { color: t.sub, fontSize: 12, fontWeight: '700' },
  heroStatLabel: { color: t.muted, fontSize: 11, fontWeight: '600' },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  allGoodText: { color: t.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  title: { color: t.text, fontSize: 15, fontWeight: '700' },
  detail: { color: t.sub, fontSize: 12, fontWeight: '500', marginTop: 1 },
  meter: { paddingVertical: 7 },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  macroValue: { color: t.text, fontWeight: '800' },
  short: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  miniRow: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, backgroundColor: t.raised, borderRadius: 14, padding: 10 },
  miniLabel: { color: t.sub, fontSize: 11, fontWeight: '700' },
  miniValue: { color: t.text, fontSize: 20, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  miniSub: { color: t.sub, fontSize: 11, fontWeight: '700' },
  subhead: { color: t.sub, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  footnote: { color: t.muted, fontSize: 11, marginTop: 12, lineHeight: 15 },
});
