import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, fromKey } from '../lib/date';
import type { DayResult } from '../lib/insights';
import { heatColor, theme as t } from '../theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Calendar of daily completion, single-hue ramp. Tap a day to read it. */
export function Heatmap({ from, count, today, results }: { from: string; count: number; today: string; results: Record<string, DayResult> }) {
  const [sel, setSel] = useState(today);
  // Pad the first row so columns line up with weekdays (Monday first).
  const lead = (fromKey(from).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let i = 0; i < count; i++) cells.push(addDays(from, i));
  const cur = results[sel];

  return (
    <View>
      <View style={s.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={s.head}>
            {d}
          </Text>
        ))}
      </View>
      <View style={s.grid}>
        {cells.map((k, i) => {
          if (!k) return <View key={`pad${i}`} style={s.slot} />;
          const pct = results[k]?.percent ?? null;
          const bright = pct !== null && pct >= 50;
          return (
            <Pressable
              key={k}
              style={s.slot}
              onPress={() => {
                Haptics.selectionAsync();
                setSel(k);
              }}
              accessibilityLabel={`${k}: ${pct === null ? 'no data' : `${pct}%`}`}>
              <View style={[s.cell, { backgroundColor: heatColor(t, pct) }, k === sel && { borderColor: t.text }]}>
                <Text style={[s.day, { color: bright ? t.onAccent : pct === null ? t.muted : t.text }]}>{fromKey(k).getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={s.legend}>
        <Text style={s.legendText}>Less</Text>
        {t.heat.map((c) => (
          <View key={c} style={[s.swatch, { backgroundColor: c }]} />
        ))}
        <Text style={s.legendText}>100%</Text>
        <View style={[s.swatch, { backgroundColor: t.track, marginLeft: 10 }]} />
        <Text style={s.legendText}>No data</Text>
      </View>
      <Text style={s.caption}>
        {fromKey(sel).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
        {' · '}
        {!cur || cur.percent === null ? 'no data' : `${cur.percent}% · ${cur.mealsDone}/${cur.meals.length} meals · ${cur.suppsTaken}/${cur.supplements.length} supps`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: t.muted, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cell: { flex: 1, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: t.muted, fontSize: 11, fontWeight: '600', marginHorizontal: 2 },
  caption: { color: t.sub, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 },
});
