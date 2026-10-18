import { StyleSheet, Text, View } from 'react-native';

import type { MuscleGroup } from '../data/plan';
import { theme as t } from '../theme';
import { Icon } from './ui';

/**
 * Horizontal single-hue bars: training days per muscle group out of `outOf` days.
 * Values are direct-labelled, so no legend or tooltip is needed.
 */
export function GroupBars({ counts, outOf }: { counts: { group: MuscleGroup; days: number }[]; outOf: number }) {
  return (
    <View accessibilityLabel={counts.map((c) => `${c.group.label} ${c.days} days`).join(', ')}>
      {counts.map(({ group, days }) => (
        <View key={group.id} style={s.row}>
          <View style={s.label}>
            <Icon name={group.icon} size={13} color={t.sub} />
            <Text style={s.labelText} numberOfLines={1}>
              {group.label}
            </Text>
          </View>
          <View style={s.track}>
            <View style={[s.bar, { width: `${Math.max(4, (days / Math.max(1, outOf)) * 100)}%` }]} />
          </View>
          <Text style={s.value}>
            {days}
            <Text style={s.valueUnit}>d</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  label: { width: 92, flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelText: { color: t.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  track: { flex: 1, height: 12, borderRadius: 4, backgroundColor: t.track, overflow: 'hidden' },
  bar: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: t.accent },
  value: { width: 32, textAlign: 'right', color: t.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  valueUnit: { color: t.sub, fontSize: 11, fontWeight: '700' },
});
