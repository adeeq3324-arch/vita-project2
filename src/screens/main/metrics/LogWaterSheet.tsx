import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useResource } from '@/hooks';
import { addWater, getDay } from '@/services/metrics/metricsService';
import { emitDataChanged } from '@/services/dataBus';
import { colors, radius, spacing, typography } from '@/theme';

/** The three portions that cover almost every entry, millilitres. */
const QUICK_AMOUNTS = [250, 500, 750] as const;

const MAX_SINGLE_ENTRY_ML = 5000;

/**
 * Water quick-add.
 *
 * Water is the one metric logged many times a day, so it is the one thing worth
 * a slot on the floating action button: two taps from anywhere in the app, with
 * the day's running total visible so the user can see what the tap did.
 *
 * Amounts are sent as deltas, not totals — two glasses logged in quick
 * succession must add up rather than overwrite each other.
 */
export function LogWaterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Log Water">
      <WaterForm />
    </BottomSheet>
  );
}

/**
 * The form itself. Mounted only while the sheet is open (see `BottomSheet`),
 * which is also what re-reads the day's total on each opening: it may have moved
 * since the sheet last closed, and a stale figure here is worse than none.
 */
function WaterForm() {
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const metrics = useResource(() => getDay(), []);

  const waterMl = metrics.data?.waterMl ?? 0;
  const targetMl = metrics.data?.waterTargetMl ?? 0;
  const progress = targetMl > 0 ? Math.min(waterMl / targetMl, 1) : 0;
  const remaining = Math.max(targetMl - waterMl, 0);

  const customMl = Number.parseInt(custom, 10);
  const customValid = Number.isFinite(customMl) && customMl > 0 && customMl <= MAX_SINGLE_ENTRY_ML;

  const log = async (amountMl: number) => {
    setSaving(true);
    try {
      await addWater(amountMl);
      emitDataChanged('metrics');
      setCustom('');
      await metrics.refresh();
    } catch (error) {
      Alert.alert(
        'Could not log that',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Text style={styles.total}>
        {targetMl > 0
          ? `${(waterMl / 1000).toFixed(1)} L of ${(targetMl / 1000).toFixed(1)} L today`
          : 'Today’s hydration'}
      </Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.remaining}>
        {metrics.loading
          ? 'Loading today’s total…'
          : remaining > 0
            ? `${remaining} ml to go`
            : 'Daily target reached — nice.'}
      </Text>

      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => void log(amount)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={`Add ${amount} millilitres`}
            style={({ pressed }) => [styles.quick, pressed && styles.quickPressed]}
          >
            <MaterialCommunityIcons name="cup-water" size={22} color={colors.metric.water} />
            <Text style={styles.quickText}>+{amount}</Text>
            <Text style={styles.quickUnit}>ml</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.customRow}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder="Other amount"
          placeholderTextColor={colors.text.disabled}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.inputUnit}>ml</Text>
        <Pressable
          onPress={() => void log(customMl)}
          disabled={!customValid || saving}
          accessibilityRole="button"
          accessibilityLabel="Add custom amount"
          style={({ pressed }) => [
            styles.addBtn,
            (!customValid || saving) && styles.addBtnDisabled,
            pressed && styles.addBtnPressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <MaterialCommunityIcons name="plus" size={20} color={colors.white} />
          )}
        </Pressable>
      </View>

      {waterMl > 0 ? (
        <Pressable
          onPress={() => void log(-Math.min(250, waterMl))}
          disabled={saving}
          accessibilityRole="button"
          style={styles.undo}
        >
          <MaterialCommunityIcons name="undo" size={15} color={colors.text.tertiary} />
          <Text style={styles.undoText}>Remove 250 ml</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  total: {
    ...typography.h4,
    color: colors.text.primary,
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.metric.water,
  },
  remaining: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.metricSurface.water,
    gap: 2,
  },
  quickPressed: {
    opacity: 0.7,
  },
  quickText: {
    ...typography.h4,
    color: colors.text.primary,
  },
  quickUnit: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    ...typography.body,
    color: colors.text.primary,
  },
  inputUnit: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.primarySurface,
  },
  addBtnPressed: {
    backgroundColor: colors.primaryDark,
  },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  undoText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
