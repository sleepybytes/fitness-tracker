import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { DURATION_CHOICES, MUSCLE_GROUPS, isWorkoutLogged, workoutSummary } from '../data/plan';
import { addDays, formatDayLabel, type DateKey } from '../lib/date';
import type { Intensity } from '../lib/types';
import { latestWeight, recentEntries } from '../lib/workoutInsights';
import { useTracker } from '../store/useTracker';
import { radius, theme as t } from '../theme';
import { Icon, RoundIconButton, SectionLabel, styles as ui } from './ui';

const INTENSITIES: { key: Intensity; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'hard', label: 'Hard' },
];

/** Workout log for one day; past days are view-only. Re-mount (key by day) when the day changes. */
export function WorkoutLogger({ day, today }: { day: DateKey; today: DateKey }) {
  const readOnly = day !== today;
  const log = useTracker((s) => s.logs[day]);
  const logs = useTracker((s) => s.logs);
  const a = useTracker.getState();
  const w = log?.workout;
  const groups = w?.groups ?? [];
  const entries = w?.entries ?? [];
  const rest = !!w?.rest;
  const logged = isWorkoutLogged(log);
  const summary = workoutSummary(log);

  const [entry, setEntry] = useState('');
  const [note, setNote] = useState(w?.note ?? '');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  const tick = () => Haptics.selectionAsync();
  const addEntry = (text: string) => {
    if (!text.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    a.addEntry(day, text);
    setEntry('');
  };
  const quickAdd = recentEntries(logs, day, entries);

  return (
    <View>
      {/* Status */}
      <View style={[ui.card, s.status, logged && { borderColor: t.accent + '55' }]}>
        <View style={[s.statusIcon, { backgroundColor: logged ? t.accent + '22' : t.raised }]}>
          <Icon name={rest ? 'bed.double.fill' : logged ? 'checkmark.circle.fill' : 'dumbbell.fill'} size={20} color={logged ? t.accent : t.sub} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.statusEyebrow}>{formatDayLabel(day, today)}&apos;s workout</Text>
          <Text style={s.statusTitle} numberOfLines={2}>
            {summary ?? 'Not logged yet'}
          </Text>
        </View>
        <View style={[s.restToggle, readOnly && { display: 'none' }]}>
          <Text style={s.restLabel}>Rest day</Text>
          <Switch
            disabled={readOnly}
            value={rest}
            onValueChange={(v) => {
              tick();
              a.setRestDay(day, v);
            }}
            trackColor={{ true: t.accent, false: t.track }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={t.track}
            accessibilityLabel="Rest day"
          />
        </View>
      </View>

      <View style={rest && s.dimmed} pointerEvents={rest || readOnly ? 'none' : 'auto'}>
        {/* Muscle groups */}
        <SectionLabel right={readOnly ? undefined : <Text style={s.hint}>Pick any</Text>}>What did you train?</SectionLabel>
        <View style={s.grid}>
          {MUSCLE_GROUPS.map((g) => {
            const on = groups.includes(g.id);
            return (
              <View key={g.id} style={s.gridSlot}>
                <Pressable
                  onPress={() => {
                    tick();
                    a.toggleGroup(day, g.id);
                  }}
                  disabled={readOnly}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: readOnly }}
                  accessibilityLabel={g.label}
                  style={({ pressed }) => [s.tile, on && s.tileOn, readOnly && !on && s.tileOff, pressed && { transform: [{ scale: 0.96 }] }]}>
                  <Icon name={g.icon} size={22} color={on ? t.onAccent : t.sub} />
                  <Text style={[s.tileText, on && { color: t.onAccent }]}>{g.label}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Exercises */}
        <SectionLabel right={readOnly ? undefined : <Text style={s.hint}>e.g. Hammer curl 3×12</Text>}>Exercises</SectionLabel>
        <View style={ui.card}>
          {entries.map((e, i) => (
            <View key={`${e}-${i}`} style={s.entryRow}>
              <View style={s.entryDot} />
              <Text style={s.entryText}>{e}</Text>
              {!readOnly ? (
                <Pressable onPress={() => a.removeEntry(day, i)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${e}`}>
                  <Icon name="xmark.circle.fill" size={18} color={t.muted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {readOnly && entries.length === 0 ? <Text style={s.empty}>No exercises logged.</Text> : null}
          <View style={[s.inputRow, entries.length > 0 && { marginTop: 10 }, readOnly && { display: 'none' }]}>
            <TextInput
              value={entry}
              onChangeText={setEntry}
              onSubmitEditing={() => addEntry(entry)}
              submitBehavior="submit"
              placeholder="Add an exercise (Cycling 15 min)"
              placeholderTextColor={t.muted}
              returnKeyType="done"
              style={s.input}
              accessibilityLabel="New exercise"
            />
            <Pressable
              onPress={() => addEntry(entry)}
              disabled={!entry.trim()}
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
              style={[s.addBtn, !entry.trim() && { opacity: 0.4 }]}>
              <Icon name="plus" size={16} color={t.onAccent} />
            </Pressable>
          </View>
          {!readOnly && quickAdd.length > 0 ? (
            <>
              <Text style={s.quickLabel}>Recent</Text>
              <View style={s.chips}>
                {quickAdd.map((q) => (
                  <Pressable key={q} onPress={() => addEntry(q)} accessibilityRole="button" accessibilityLabel={`Add ${q}`} style={s.chip}>
                    <Icon name="plus" size={10} color={t.sub} />
                    <Text style={s.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* Duration + intensity */}
        <SectionLabel>Session</SectionLabel>
        <View style={ui.card}>
          <Text style={s.fieldLabel}>Duration</Text>
          <View style={s.chips}>
            {DURATION_CHOICES.map((m) => (
              <Pill
                key={m}
                label={`${m} min`}
                active={w?.minutes === m}
                readOnly={readOnly}
                onPress={() => {
                  tick();
                  a.setWorkoutMinutes(day, w?.minutes === m ? null : m);
                }}
              />
            ))}
          </View>
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>Intensity</Text>
          <View style={s.chips}>
            {INTENSITIES.map((i) => (
              <Pill
                key={i.key}
                label={i.label}
                active={w?.intensity === i.key}
                readOnly={readOnly}
                onPress={() => {
                  tick();
                  a.setIntensity(day, w?.intensity === i.key ? null : i.key);
                }}
              />
            ))}
          </View>
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>Notes</Text>
          {readOnly ? (
            <Text style={note ? s.noteText : s.empty}>{note || 'No notes.'}</Text>
          ) : (
            <TextInput
              value={note}
              onChangeText={(v) => {
                setNote(v);
                clearTimeout(noteTimer.current);
                noteTimer.current = setTimeout(() => a.setWorkoutNote(day, v.trim()), 500);
              }}
              onBlur={() => a.setWorkoutNote(day, note.trim())}
              placeholder="How did it feel? Any PRs or soreness?"
              placeholderTextColor={t.muted}
              multiline
              style={[s.input, s.noteInput]}
              accessibilityLabel="Workout notes"
            />
          )}
        </View>
      </View>

      <WeightCard day={day} readOnly={readOnly} />
    </View>
  );
}

function Pill({ label, active, onPress, readOnly }: { label: string; active: boolean; onPress: () => void; readOnly?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.pill, active && { backgroundColor: t.accent, borderColor: t.accent }, readOnly && !active && s.tileOff]}>
      <Text style={[s.pillText, active && { color: t.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

function WeightCard({ day, readOnly }: { day: DateKey; readOnly: boolean }) {
  const logs = useTracker((s) => s.logs);
  const setWeight = useTracker((s) => s.setWeight);
  const todayKg = logs[day]?.weightKg;
  const prev = latestWeight(logs, addDays(day, -1));
  const latest = latestWeight(logs, day);
  const [text, setText] = useState(todayKg ? String(todayKg) : '');

  const commit = (v: string) => {
    const kg = parseFloat(v.replace(',', '.'));
    setWeight(day, Number.isFinite(kg) ? kg : null);
  };
  const step = (delta: number) => {
    Haptics.selectionAsync();
    const base = todayKg ?? prev?.kg ?? 70;
    const kg = Math.round((base + delta) * 10) / 10;
    setText(String(kg));
    setWeight(day, kg);
  };

  return (
    <>
      <SectionLabel right={readOnly ? undefined : <Text style={s.hint}>Weekly is enough</Text>}>Body weight</SectionLabel>
      <View style={ui.card}>
        {readOnly ? (
          <Text style={[s.weightInput, s.weightReadOnly]}>
            {todayKg ?? '—'}
            {todayKg ? <Text style={s.weightUnit}> kg</Text> : null}
          </Text>
        ) : (
          <View style={s.weightRow}>
            <RoundIconButton icon="minus" label="Decrease weight by 0.1 kg" onPress={() => step(-0.1)} />
            <View style={s.weightField}>
              <TextInput
                value={text}
                onChangeText={setText}
                onEndEditing={() => commit(text)}
                keyboardType="decimal-pad"
                placeholder={prev ? String(prev.kg) : '—'}
                placeholderTextColor={t.muted}
                style={s.weightInput}
                accessibilityLabel="Body weight in kg"
              />
              <Text style={s.weightUnit}>kg</Text>
            </View>
            <RoundIconButton icon="plus" label="Increase weight by 0.1 kg" onPress={() => step(0.1)} />
          </View>
        )}
        <Text style={s.weightMeta}>
          {readOnly && !todayKg
            ? 'Not logged this day.'
            : latest
            ? `Last: ${latest.kg} kg${latest.weekChange !== null ? ` · ${latest.weekChange >= 0 ? '+' : ''}${latest.weekChange} kg in 7 days` : ''}`
            : 'Log your weight to track the lean bulk.'}
        </Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusEyebrow: { color: t.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  statusTitle: { color: t.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
  restToggle: { alignItems: 'center', gap: 4 },
  restLabel: { color: t.sub, fontSize: 11, fontWeight: '700' },
  dimmed: { opacity: 0.35 },
  hint: { color: t.muted, fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 4 },
  gridSlot: { width: '33.333%', padding: 4 },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.inner,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  tileOn: { backgroundColor: t.accent, borderColor: t.accent },
  tileOff: { opacity: 0.35 },
  empty: { color: t.muted, fontSize: 14, fontWeight: '600' },
  noteText: { color: t.text, fontSize: 15, lineHeight: 21 },
  weightReadOnly: { width: undefined, alignSelf: 'center' },
  tileText: { color: t.text, fontSize: 13, fontWeight: '700' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  entryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.accent },
  entryText: { flex: 1, color: t.text, fontSize: 15, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    color: t.text,
    fontSize: 15,
    backgroundColor: t.raised,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: t.border,
  },
  noteInput: { minHeight: 70, textAlignVertical: 'top', flex: 0 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: t.raised,
    borderWidth: 1,
    borderColor: t.border,
  },
  chipText: { color: t.text, fontSize: 13, fontWeight: '600' },
  fieldLabel: { color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: t.border, backgroundColor: t.raised },
  pillText: { color: t.text, fontSize: 13, fontWeight: '700' },
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weightField: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  weightInput: { color: t.text, fontSize: 34, fontWeight: '900', width: 110, textAlign: 'center', fontVariant: ['tabular-nums'] },
  weightUnit: { color: t.sub, fontSize: 16, fontWeight: '800' },
  weightMeta: { color: t.sub, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
