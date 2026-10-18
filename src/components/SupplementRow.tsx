import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDose } from '../data/plan';
import { formatTime } from '../lib/date';
import type { SuppResult } from '../lib/insights';
import { radius, theme as t } from '../theme';
import { Icon, StatusPill } from './ui';

const SUPP_ICON: Record<string, string> = {
  protein: 'scalemass.fill',
  multivitamin: 'pills.fill',
  omega3: 'drop.circle.fill',
};

export function SupplementRow({
  result,
  onSet,
  readOnly,
}: {
  result: SuppResult;
  onSet: (amount: number | null) => void;
  /** Past days: show what was taken, no changes. */
  readOnly?: boolean;
}) {
  const { supp, amount, time, missed } = result;
  const taken = amount !== null;

  const pick = (dose: number) => {
    if (amount === dose) Haptics.selectionAsync();
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSet(amount === dose ? null : dose);
  };

  return (
    <View style={[s.card, taken && { borderColor: t.supp + '66' }]}>
      <View style={s.top}>
        <View style={[s.iconTile, { backgroundColor: t.supp + (taken ? '33' : '1A') }]}>
          <Icon name={SUPP_ICON[supp.id] ?? 'pills.fill'} size={20} color={t.supp} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{supp.name}</Text>
          <View style={s.timeRow}>
            <Icon name="bell.fill" size={10} color={t.muted} />
            <Text style={s.time}>{formatTime(time)}</Text>
          </View>
        </View>
        {taken ? (
          <View style={[s.taken, { backgroundColor: t.supp + '22' }]}>
            <Icon name="checkmark" size={11} color={t.supp} />
            <Text style={[s.takenText, { color: t.supp }]}>{formatDose(amount, supp.unit)}</Text>
          </View>
        ) : missed ? (
          <StatusPill status="missed" />
        ) : null}
      </View>

      <View style={s.doses}>
        {supp.doses.map((d) => {
          const active = amount === d;
          return (
            <Pressable
              key={d}
              onPress={() => pick(d)}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: readOnly }}
              accessibilityLabel={formatDose(d, supp.unit)}
              style={({ pressed }) => [
                s.dose,
                active && { backgroundColor: t.supp, borderColor: t.supp },
                readOnly && !active && { opacity: 0.4 },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}>
              <Text style={[s.doseNum, { color: active ? t.onAccent : t.text }]}>{d}</Text>
              <Text style={[s.doseUnit, { color: active ? t.onAccent : t.sub }]}>{formatDose(d, supp.unit).split(' ')[1]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: t.card,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { color: t.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  time: { color: t.sub, fontSize: 12, fontWeight: '600' },
  taken: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  takenText: { fontSize: 12, fontWeight: '800' },
  doses: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dose: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.inner,
    backgroundColor: t.raised,
    borderWidth: 1,
    borderColor: t.border,
  },
  doseNum: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  doseUnit: { fontSize: 11, fontWeight: '700', marginTop: 1 },
});
