import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { fromKey } from '../lib/date';
import type { DayResult } from '../lib/insights';
import { theme as t } from '../theme';

const H = 150; // plot height
const TOP = 22; // room for the selected value label
const LEFT = 30; // y-axis labels
const R = 4; // rounded data-end radius
const GAP = 2; // surface gap between bars (min)
const FONT = 'Helvetica Neue';

/** Rounded top, square base anchored on the baseline. */
function barPath(x: number, w: number, y: number, base: number) {
  const r = Math.min(R, w / 2, base - y);
  return `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${base} Z`;
}

/** Single-series column chart of daily completion %. Tap a bar to read its value. */
export function DayBars({ days }: { days: DayResult[] }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const selected = sel ?? days.length - 1;

  const plotW = Math.max(0, width - LEFT);
  const slot = days.length ? plotW / days.length : 0;
  const barW = Math.max(4, Math.min(28, slot * 0.62));
  const base = TOP + H;
  const y = (pct: number) => base - (pct / 100) * H;

  const cur = days[selected];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View>
          <Svg width={width} height={base + 24}>
            {[0, 50, 100].map((g) => (
              <Line
                key={g}
                x1={LEFT}
                x2={width}
                y1={y(g)}
                y2={y(g)}
                stroke={g === 0 ? t.muted : t.border}
                strokeWidth={1}
                strokeDasharray={g === 0 ? undefined : '3 4'}
              />
            ))}
            {[50, 100].map((g) => (
              <SvgText key={g} x={0} y={y(g) + 4} fill={t.muted} fontSize={10} fontWeight="600" fontFamily={FONT}>
                {`${g}%`}
              </SvgText>
            ))}
            {days.map((d, i) => {
              const cx = LEFT + slot * i + slot / 2;
              const x = cx - Math.min(barW, slot - GAP) / 2;
              const w = Math.min(barW, slot - GAP);
              const active = i === selected;
              const pct = d.percent;
              return (
                <G key={d.key}>
                  {pct === null ? (
                    <Line x1={x} x2={x + w} y1={base - 1} y2={base - 1} stroke={t.muted} strokeWidth={2} />
                  ) : pct > 0 ? (
                    <Path d={barPath(x, w, y(pct), base)} fill={active ? t.accent : t.accent + '8C'} />
                  ) : null}
                  {active && pct !== null ? (
                    <SvgText x={cx} y={y(pct) - 7} fill={t.text} fontSize={12} fontWeight="800" fontFamily={FONT} textAnchor="middle">
                      {`${pct}%`}
                    </SvgText>
                  ) : null}
                  {days.length <= 10 || i % 5 === 0 || active ? (
                    <SvgText
                      x={cx}
                      y={base + 16}
                      fill={active ? t.text : t.muted}
                      fontSize={10}
                      fontWeight={active ? '800' : '600'}
                      fontFamily={FONT}
                      textAnchor="middle">
                      {days.length <= 10
                        ? fromKey(d.key).toLocaleDateString(undefined, { weekday: 'narrow' })
                        : String(fromKey(d.key).getDate())}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </Svg>
          {/* Hit targets wider than the marks. */}
          <View style={[StyleSheet.absoluteFill, { left: LEFT, flexDirection: 'row' }]}>
            {days.map((d, i) => (
              <Pressable
                key={d.key}
                style={{ flex: 1 }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSel(i);
                }}
                accessibilityLabel={`${d.key}: ${d.percent === null ? 'no data' : `${d.percent}% complete`}`}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ height: base + 24 }} />
      )}
      {cur ? (
        <Text style={s.caption}>
          {fromKey(cur.key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
          {' · '}
          {cur.percent === null ? 'nothing due' : `${cur.percent}% · ${cur.mealsDone}/${cur.meals.length} meals · ${cur.suppsTaken}/${cur.supplements.length} supps`}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caption: { color: t.sub, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
