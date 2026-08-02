import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { emitDataChanged } from '@/services/dataBus';
import { update as updateMetrics } from '@/services/metrics/metricsService';
import { profileService } from '@/services';
import { colors, layout, radius, spacing, typography } from '@/theme';

const MIN_KG = 20;
const MAX_KG = 500;

/**
 * Weigh-in.
 *
 * Writes two places on purpose. The day's metric is what the weight line plots
 * and what goal progress is measured from; the profile weight is what BMR, TDEE
 * and therefore every calorie and macro target are derived from. Updating only
 * the first would leave a user who lost 8 kg still eating for the body they had
 * at sign-up.
 */
export function LogWeightSheet({
  visible,
  onClose,
  currentKg,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  /** Last known weight, used to prefill. */
  currentKg: number | null;
  onSaved?: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Log Weight"
      subtitle="Weigh yourself at the same time each day for a trend you can trust."
    >
      <WeightForm currentKg={currentKg} onClose={onClose} onSaved={onSaved} />
    </BottomSheet>
  );
}

/**
 * The form itself. Mounted only while the sheet is open (see `BottomSheet`), so
 * it opens prefilled from the latest weight without an effect having to reset
 * it — most weigh-ins are a small edit of the last one, not a number typed from
 * scratch.
 */
function WeightForm({
  currentKg,
  onClose,
  onSaved,
}: {
  currentKg: number | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(currentKg !== null ? String(currentKg) : '');
  const [saving, setSaving] = useState(false);

  const parsed = Number.parseFloat(value.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed >= MIN_KG && parsed <= MAX_KG;
  const outOfRange = value.trim().length > 0 && !valid;

  const delta = valid && currentKg !== null ? Math.round((parsed - currentKg) * 10) / 10 : null;

  const save = async () => {
    if (!valid) return;
    const weightKg = Math.round(parsed * 100) / 100;

    setSaving(true);
    try {
      await updateMetrics({ weightKg });
      // Targets follow body weight. A failure here must not lose the weigh-in
      // itself, which is already stored — so it is reported, not thrown away.
      try {
        await profileService.updateProfile({ weight: weightKg });
      } catch {
        Alert.alert(
          'Weight saved',
          'Your weigh-in was recorded, but your calorie targets could not be updated. They will catch up next time you edit your profile.',
        );
      }
      emitDataChanged('metrics');
      onSaved?.();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not save that weigh-in',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="0.0"
          placeholderTextColor={colors.text.disabled}
          keyboardType="decimal-pad"
          selectTextOnFocus
          autoFocus
          style={[styles.input, outOfRange && styles.inputInvalid]}
        />
        <Text style={styles.unit}>kg</Text>
      </View>

      {outOfRange ? (
        <Text style={styles.error}>
          Enter a weight between {MIN_KG} and {MAX_KG} kg.
        </Text>
      ) : delta !== null && delta !== 0 ? (
        <Text style={[styles.delta, delta < 0 ? styles.deltaDown : styles.deltaUp]}>
          {delta > 0 ? '+' : ''}
          {delta} kg since your last weigh-in
        </Text>
      ) : (
        <Text style={styles.hint}>Your calorie and macro targets update with it.</Text>
      )}

      <Pressable
        onPress={() => void save()}
        disabled={!valid || saving}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.saveBtn,
          (!valid || saving) && styles.saveDisabled,
          pressed && styles.savePressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveText}>Save Weigh-in</Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  input: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
    minWidth: 140,
    height: 72,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  inputInvalid: {
    borderBottomColor: colors.danger,
  },
  unit: {
    ...typography.h3,
    color: colors.text.tertiary,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  delta: {
    ...typography.label,
    textAlign: 'center',
  },
  deltaDown: {
    color: colors.success,
  },
  deltaUp: {
    color: colors.text.secondary,
  },
  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  saveBtn: {
    height: layout.ctaHeight,
    borderRadius: radius.base,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    backgroundColor: colors.primarySurface,
  },
  savePressed: {
    backgroundColor: colors.primaryDark,
  },
  saveText: {
    ...typography.button,
    color: colors.white,
  },
});
