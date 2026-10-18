import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { fromKey, keysBetween, type DateKey } from '../lib/date';
import type { WeightPoint } from '../lib/workoutInsights';
import { theme as t } from '../theme';

const H = 130;
const TOP = 14;
const LEFT = 40;
const RIGHT = 8;
const FONT = 'Helvetica Neue';

/** Single-series body-weight line over [from, to]. Tap anywhere to read the nearest point. */
export function WeightLine({ points, from, to }: { points: WeightPoint[]; from: DateKey; to: DateKey }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const selected = sel ?? points.length - 1;

  const days = keysBetween(from, to);
  const idx = (k: DateKey) => days.indexOf(k);
  const kgs = points.map((p) => p.kg);
  const lo = Math.floor((Math.min(...kgs) - 0.3) * 2) / 2;
  const hi = Math.ceil((Math.max(...kgs) + 0.3) * 2) / 2;
  const plotW = Math.max(1, width - LEFT - RIGHT);
  const x = (k: DateKey) => LEFT + (days.length > 1 ? (idx(k) / (days.length - 1)) * plotW : plotW / 2);
  const y = (kg: number) => TOP + (1 - (kg - lo) / (hi - lo || 1)) * H;
  const base = TOP + H;

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.key).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const cur = points[selected];

  const pick = (px: number) => {
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.key) - px) < Math.abs(x(points[best].key) - px)) best = i;
    });
    Haptics.selectionAsync();
    setSel(best);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View>
          <Svg width={width} height={base + 22}>
            {[hi, (hi + lo) / 2, lo].map((v, i) => (
              <Line key={i} x1={LEFT} x2={width - RIGHT} y1={y(v)} y2={y(v)} stroke={i === 2 ? t.muted : t.border} strokeDasharray={i === 2 ? undefined : '3 4'} />
            ))}
            {[hi, lo].map((v) => (
              <SvgText key={v} x={0} y={y(v) + 4} fill={t.muted} fontSize={10} fontWeight="600" fontFamily={FONT}>
                {`${v} kg`}
              </SvgText>
            ))}
            {points.length > 1 ? <Path d={d} stroke={t.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {points.map((p, i) => (
              <Circle
                key={p.key}
                cx={x(p.key)}
                cy={y(p.kg)}
                r={i === selected ? 6 : 4}
                fill={i === selected ? t.accent : t.card}
                stroke={t.accent}
                strokeWidth={2}
              />
            ))}
            {[from, to].map((k, i) => (
              <SvgText
                key={k}
                x={i ? width - RIGHT : LEFT}
                y={base + 16}
                fill={t.muted}
                fontSize={10}
                fontWeight="600"
                fontFamily={FONT}
                textAnchor={i ? 'end' : 'start'}>
                {fromKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </SvgText>
            ))}
          </Svg>
          <Pressable
            style={[StyleSheet.absoluteFill, { left: LEFT }]}
            onPress={(e) => pick(e.nativeEvent.locationX + LEFT)}
            accessibilityLabel={`Body weight: ${points.map((p) => `${p.key} ${p.kg} kg`).join(', ')}`}
          />
        </View>
      ) : (
        <View style={{ height: base + 22 }} />
      )}
      {cur ? (
        <Text style={s.caption}>
          {fromKey(cur.key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} · {cur.kg} kg
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caption: { color: t.sub, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
