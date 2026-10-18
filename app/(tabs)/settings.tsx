import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Icon, ScreenTitle, SectionLabel } from '@/src/components/ui';
import { MEALS, SUMMARY_TIME, SUPPLEMENTS, WORKOUT_LOG_TIME } from '@/src/data/plan';
import { atTime, formatTime, normalizeTime, toKey } from '@/src/lib/date';
import { SCHEDULE_DAYS, WORKOUT_LOG_SLOT, ensurePermission, pendingCount, sendTestNotification } from '@/src/lib/notifications';
import { useTracker } from '@/src/store/useTracker';
import { theme as t } from '@/src/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useTracker((s) => s.settings);
  const { setRemindersOn, setSummaryOn, setSlotEnabled, setSuppTime, setWorkoutLogTime, resetAll } = useTracker.getState();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  const refresh = useCallback(() => {
    Notifications.getPermissionsAsync().then((p) => setGranted(p.granted));
    // Give the debounced reschedule a moment before counting.
    const id = setTimeout(() => pendingCount().then(setPending), 2500);
    return () => clearTimeout(id);
  }, []);
  useFocusEffect(refresh);

  const test = async () => {
    if (!(await ensurePermission())) {
      setGranted(false);
      return;
    }
    await sendTestNotification();
    Alert.alert('Test sent', 'A notification will appear in about 3 seconds. Lock your phone or switch apps to see the banner.');
  };

  const confirmReset = () =>
    Alert.alert('Reset all data?', 'This deletes every logged day and restores default settings. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetAll },
    ]);

  const enabled = (id: string) => settings.slotEnabled[id] !== false;
  const today = toKey(new Date());

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <ScreenTitle eyebrow="Reminders & data" title="Settings" />

      {granted === false ? (
        <Card style={{ borderColor: t.missed + '80' }}>
          <View style={s.warnRow}>
            <Icon name="bell.slash.fill" size={18} color={t.missed} />
            <Text style={s.label}>Notifications are off</Text>
          </View>
          <Text style={s.help}>Allow notifications for this app in iOS Settings to get reminders.</Text>
          <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 10 }}>
            <Text style={{ color: t.accent, fontWeight: '700' }}>Open iOS Settings</Text>
          </Pressable>
        </Card>
      ) : null}

      <SectionLabel>Reminders</SectionLabel>
      <Card style={s.group}>
        <SwitchRow icon="bell.fill" iconColor={t.accent} label="Meal & supplement reminders" value={settings.remindersOn} onChange={setRemindersOn} />
        <SwitchRow
          icon="moon.fill"
          iconColor={t.supp}
          label={`Daily check-in at ${formatTime(SUMMARY_TIME)}`}
          sub="Summary of what you missed"
          value={settings.summaryOn}
          onChange={setSummaryOn}
          disabled={!settings.remindersOn}
          last
        />
      </Card>
      <Text style={s.footer}>
        Reminders are scheduled {SCHEDULE_DAYS} days ahead and refreshed every time you open the app. Anything you&apos;ve
        already logged won&apos;t remind you.{pending !== null ? ` ${pending} reminders pending.` : ''}
      </Text>

      <SectionLabel>Meals</SectionLabel>
      <Card style={s.group}>
        {MEALS.map((m, i) => (
          <SwitchRow
            key={m.id}
            label={m.title}
            sub={formatTime(m.time)}
            value={enabled(m.id)}
            onChange={(v) => setSlotEnabled(m.id, v)}
            disabled={!settings.remindersOn}
            last={i === MEALS.length - 1}
          />
        ))}
      </Card>

      <SectionLabel>Supplements</SectionLabel>
      <Card style={s.group}>
        {SUPPLEMENTS.map((sp, i) => {
          const time = settings.suppTimes[sp.id] ?? sp.defaultTime;
          return (
            <SwitchRow
              key={sp.id}
              label={sp.name}
              value={enabled(sp.id)}
              onChange={(v) => setSlotEnabled(sp.id, v)}
              disabled={!settings.remindersOn}
              last={i === SUPPLEMENTS.length - 1}
              extra={
                <DateTimePicker
                  mode="time"
                  display="compact"
                  themeVariant="dark"
                  value={atTime(today, time)}
                  minuteInterval={5}
                  accentColor={t.accent}
                  onChange={(_, d) => d && setSuppTime(sp.id, normalizeTime(`${d.getHours()}:${d.getMinutes()}`))}
                  style={{ marginTop: 6, marginLeft: -8, alignSelf: 'flex-start' }}
                />
              }
            />
          );
        })}
      </Card>

      <SectionLabel>Exercise</SectionLabel>
      <Card style={s.group}>
        <SwitchRow
          icon="dumbbell.fill"
          iconColor={t.accent}
          label="Log today's workout"
          sub="Reminder after training; skipped once logged"
          value={enabled(WORKOUT_LOG_SLOT)}
          onChange={(v) => setSlotEnabled(WORKOUT_LOG_SLOT, v)}
          disabled={!settings.remindersOn}
          last
          extra={
            <DateTimePicker
              mode="time"
              display="compact"
              themeVariant="dark"
              value={atTime(today, settings.workoutLogTime ?? WORKOUT_LOG_TIME)}
              minuteInterval={5}
              accentColor={t.accent}
              onChange={(_, d) => d && setWorkoutLogTime(normalizeTime(`${d.getHours()}:${d.getMinutes()}`))}
              style={{ marginTop: 6, marginLeft: -8, alignSelf: 'flex-start' }}
              accessibilityLabel="Workout log reminder time"
            />
          }
        />
      </Card>

      <SectionLabel>Tools</SectionLabel>
      <Card style={s.group}>
        <ActionRow icon="paperplane.fill" label="Send test notification" color={t.accent} onPress={test} />
        <ActionRow icon="trash.fill" label="Reset all data" color={t.missed} onPress={confirmReset} last />
      </Card>
    </ScrollView>
  );
}

function SwitchRow({
  icon,
  iconColor,
  label,
  sub,
  value,
  onChange,
  disabled,
  last,
  extra,
}: {
  icon?: string;
  iconColor?: string;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  extra?: ReactNode;
}) {
  return (
    <View style={[s.row, !last && s.divider]}>
      {icon ? (
        <View style={[s.iconTile, { backgroundColor: (iconColor ?? t.accent) + '1F' }]}>
          <Icon name={icon} size={14} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {sub ? <Text style={s.help}>{sub}</Text> : null}
        {extra}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: t.accent, false: t.track }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={t.track}
      />
    </View>
  );
}

function ActionRow({ icon, label, color, onPress, last }: { icon: string; label: string; color: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.row, !last && s.divider, pressed && { opacity: 0.6 }]}>
      <View style={[s.iconTile, { backgroundColor: color + '1F' }]}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <Text style={[s.label, { color, flex: 1 }]}>{label}</Text>
      <Icon name="chevron.right" size={12} color={t.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  group: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  iconTile: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { color: t.text, fontSize: 16, fontWeight: '600' },
  help: { color: t.sub, fontSize: 13, marginTop: 2 },
  footer: { color: t.muted, fontSize: 12, lineHeight: 17, marginHorizontal: 4, marginTop: -4 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
});
