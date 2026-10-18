import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { MealStatus } from '../lib/insights';
import { STATUS_META, radius, theme as t } from '../theme';

export function Icon({ name, size = 18, color = t.text }: { name: string; size?: number; color?: string }) {
  return <SymbolView name={name as SFSymbol} size={size} tintColor={color} weight="semibold" />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenTitle({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.screenTitle}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.h1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

export function Check({
  checked,
  partial,
  onPress,
  size = 30,
  label,
  color = t.done,
  disabled,
}: {
  checked: boolean;
  partial?: boolean;
  onPress: () => void;
  size?: number;
  label: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.check,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: checked ? color : partial ? t.partial : t.muted,
          backgroundColor: checked ? color : 'transparent',
          transform: [{ scale: pressed ? 0.9 : 1 }],
        },
      ]}>
      {checked ? (
        <Icon name="checkmark" size={size * 0.5} color={t.onAccent} />
      ) : partial ? (
        <View style={{ width: size * 0.4, height: 3, borderRadius: 2, backgroundColor: t.partial }} />
      ) : null}
    </Pressable>
  );
}

/** Status pill: always icon + label so state never relies on colour alone. */
export function StatusPill({ status }: { status: MealStatus }) {
  const color = t[status];
  const meta = STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: color + '1F' }]}>
      <Icon name={meta.icon} size={11} color={color} />
      <Text style={[styles.pillText, { color }]}>{meta.label}</Text>
    </View>
  );
}

export function Bar({ value, color = t.accent, height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.track, overflow: 'hidden' }}>
      {v > 0 ? <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} /> : null}
    </View>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; badge?: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityLabel={o.badge ? `${o.label}, ${o.badge}` : o.label}
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: t.raised }]}>
            <Text style={[styles.segmentText, { color: active ? t.text : t.sub }]}>{o.label}</Text>
            {o.badge ? (
              <Text style={[styles.segmentBadge, { color: active ? t.accent : t.muted }]}>{o.badge}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function GradientButton({ label, icon, onPress }: { label: string; icon?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <LinearGradient colors={[t.accent, t.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradBtn}>
        {icon ? <Icon name={icon} size={15} color={t.onAccent} /> : null}
        <Text style={styles.gradBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function RoundIconButton({
  icon,
  onPress,
  label,
  disabled,
  color = t.text,
}: {
  icon: string;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.roundBtn, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={15} color={color} />
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: t.card,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
  },
  screenTitle: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 18 },
  eyebrow: { color: t.sub, fontSize: 13, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  h1: { color: t.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionLabel: { color: t.sub, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  check: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: t.card,
    borderRadius: radius.inner,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentText: { fontSize: 14, fontWeight: '700' },
  segmentBadge: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gradBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  gradBtnText: { color: t.onAccent, fontSize: 14, fontWeight: '800' },
  roundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: t.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
