import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '../lib/date';
import type { MealResult } from '../lib/insights';
import { radius, theme as t } from '../theme';
import { Check, Icon, StatusPill } from './ui';

const MEAL_ICON: Record<string, string> = {
  waking: 'sunrise.fill',
  breakfast: 'fork.knife',
  shake: 'cup.and.saucer.fill',
  lunch: 'takeoutbag.and.cup.and.straw.fill',
  hydration: 'drop.fill',
  preworkout: 'bolt.fill',
  workout: 'dumbbell.fill',
  dinner: 'flame.fill',
  bed: 'moon.stars.fill',
};

type Props = {
  result: MealResult;
  ticked: Record<string, string>;
  onToggleMeal: (done: boolean) => void;
  onToggleItem: (itemId: string) => void;
  initiallyOpen?: boolean;
  isLast?: boolean;
  isNext?: boolean;
  /** Set for the plan's Workout slot: the row mirrors the workout log and opens it. */
  workout?: { summary: string | null; onOpen: () => void };
  /** Past days: show what was logged, no changes. */
  readOnly?: boolean;
};

/** One row of the meal timeline: time rail on the left, card on the right. */
export function MealCard({ result, ticked, onToggleMeal, onToggleItem, initiallyOpen, isLast, isNext, workout, readOnly }: Props) {
  const [open, setOpen] = useState(!!initiallyOpen);
  const { meal, status } = result;
  const done = status === 'done';
  const [clock, ampm] = formatTime(meal.time).split(' ');
  const statusColor = status === 'upcoming' ? t.muted : t[status];

  const tapMeal = () => {
    if (workout) return workout.onOpen();
    Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    if (!done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onToggleMeal(!done);
  };
  const tapItem = (id: string) => {
    Haptics.selectionAsync();
    onToggleItem(id);
  };

  return (
    <View style={s.row}>
      <View style={s.rail}>
        <Text style={[s.clock, { color: isNext ? t.accent : t.text }]}>{clock}</Text>
        <Text style={s.ampm}>{ampm}</Text>
        <View style={[s.dot, { backgroundColor: status === 'upcoming' ? t.raised : statusColor, borderColor: isNext ? t.accent : t.bg }]} />
        {!isLast ? <View style={s.line} /> : null}
      </View>

      <View style={[s.card, done && s.cardDone, isNext && { borderColor: t.accent + '66' }]}>
        <View style={s.header}>
          <Pressable
            style={s.headerMain}
            onPress={workout ? workout.onOpen : () => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={workout ? 'Open workout log' : `${open ? 'Collapse' : 'Expand'} ${meal.title}`}>
            <View style={[s.iconTile, { backgroundColor: done ? t.accent + '22' : t.raised }]}>
              <Icon name={MEAL_ICON[meal.id] ?? 'fork.knife'} size={17} color={done ? t.accent : t.sub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, done && !workout && { color: t.sub }]} numberOfLines={1}>
                {meal.title}
              </Text>
              <View style={s.metaRow}>
                {status === 'partial' || status === 'missed' ? <StatusPill status={status} /> : null}
                {workout ? (
                  <>
                    <Text style={[s.meta, workout.summary ? { color: t.accent } : null]} numberOfLines={1}>
                      {workout.summary ?? 'Tap to log'}
                    </Text>
                    <Icon name="chevron.right" size={10} color={t.muted} />
                  </>
                ) : (
                  <>
                    <Text style={s.meta} numberOfLines={1}>
                      {meal.items.length} {meal.items.length === 1 ? 'item' : 'items'}
                    </Text>
                    <Icon name={open ? 'chevron.up' : 'chevron.down'} size={10} color={t.muted} />
                  </>
                )}
              </View>
            </View>
          </Pressable>
          <Check
            checked={done}
            partial={status === 'partial'}
            onPress={tapMeal}
            label={workout ? 'Open workout log' : `Mark ${meal.title} ${done ? 'not done' : 'done'}`}
            disabled={readOnly && !workout}
          />
        </View>

        {open && !workout ? (
          <View style={s.items}>
            {meal.items.map((item) => {
              const on = !!ticked[item.id];
              return (
                <Pressable
                  key={item.id}
                  style={s.itemRow}
                  onPress={() => tapItem(item.id)}
                  disabled={readOnly}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: readOnly }}
                  accessibilityLabel={item.name}>
                  <Check checked={on} size={22} onPress={() => tapItem(item.id)} label={item.name} disabled={readOnly} />
                  <Text style={[s.itemName, on && s.itemDone]} numberOfLines={2}>
                    {item.name}
                    {item.optional ? <Text style={{ color: t.muted }}> · optional</Text> : null}
                  </Text>
                  <View style={s.qty}>
                    <Text style={s.qtyText}>{item.qty}</Text>
                  </View>
                </Pressable>
              );
            })}
            {meal.note ? (
              <View style={s.note}>
                <Icon name="lightbulb.fill" size={12} color={t.partial} />
                <Text style={s.noteText}>{meal.note}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  rail: { width: 54, alignItems: 'center', paddingTop: 14 },
  clock: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  ampm: { color: t.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 8 },
  line: { flex: 1, width: 2, backgroundColor: t.border, marginTop: 4, borderRadius: 1 },
  card: {
    flex: 1,
    backgroundColor: t.card,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: t.border,
  },
  cardDone: { backgroundColor: '#13140F', borderColor: t.accent + '33' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { color: t.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { color: t.sub, fontSize: 12, fontWeight: '600' },
  items: { marginTop: 12, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  itemName: { flex: 1, color: t.text, fontSize: 14, fontWeight: '500' },
  itemDone: { color: t.muted, textDecorationLine: 'line-through' },
  qty: { backgroundColor: t.raised, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  qtyText: { color: t.sub, fontSize: 12, fontWeight: '600' },
  note: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: t.partial + '14',
  },
  noteText: { flex: 1, color: t.sub, fontSize: 12, lineHeight: 17 },
});
