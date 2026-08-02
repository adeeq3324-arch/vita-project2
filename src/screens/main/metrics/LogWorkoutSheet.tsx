import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { emitDataChanged } from '@/services/dataBus';
import {
  INTENSITY_LABELS,
  WORKOUT_INTENSITIES,
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABELS,
  create,
  type WorkoutIntensity,
  type WorkoutType,
} from '@/services/workouts/workoutsService';
import { colors, layout, radius, spacing, typography } from '@/theme';

/** Durations that cover most sessions, minutes. */
const QUICK_MINUTES = [20, 30, 45, 60] as const;

const MAX_MINUTES = 1440;

/**
 * Workout log.
 *
 * Asks for the two things a person always knows — what they did and for how
 * long — and lets the server estimate the rest. Calories burned are deliberately
 * not asked for: a user guessing at them would feed the health score a number
 * nobody can stand behind, while the server can derive one from type, intensity,
 * duration and body weight.
 */
export function LogWorkoutSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Log Workout"
      subtitle="Twenty minutes counts. Logging it is what moves the chart."
    >
      <WorkoutForm onClose={onClose} onSaved={onSaved} />
    </BottomSheet>
  );
}

/**
 * The form itself. Mounted only while the sheet is open (see `BottomSheet`), so
 * it always opens on the defaults — yesterday's entry can never be saved again
 * by accident.
 */
function WorkoutForm({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [type, setType] = useState<WorkoutType>('strength');
  const [intensity, setIntensity] = useState<WorkoutIntensity>('moderate');
  const [minutes, setMinutes] = useState('45');
  const [saving, setSaving] = useState(false);

  const parsed = Number.parseInt(minutes, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_MINUTES;
  const outOfRange = minutes.trim().length > 0 && !valid;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await create({ type, durationMinutes: parsed, intensity });
      emitDataChanged('workouts');
      emitDataChanged('metrics');
      onSaved?.();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not log that session',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View>
        <Text style={styles.label}>What did you do?</Text>
        <View style={styles.chips}>
          {WORKOUT_TYPES.map((value) => {
            const selected = value === type;
            return (
              <Pressable
                key={value}
                onPress={() => setType(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {WORKOUT_TYPE_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={styles.label}>How long?</Text>
        <View style={styles.quickRow}>
          {QUICK_MINUTES.map((value) => {
            const selected = String(value) === minutes;
            return (
              <Pressable
                key={value}
                onPress={() => setMinutes(String(value))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.quick, selected && styles.quickSelected]}
              >
                <Text style={[styles.quickText, selected && styles.quickTextSelected]}>
                  {value}m
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.minutesRow}>
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            placeholder="45"
            placeholderTextColor={colors.text.disabled}
            keyboardType="number-pad"
            style={[styles.input, outOfRange && styles.inputInvalid]}
          />
          <Text style={styles.unit}>minutes</Text>
        </View>
        {outOfRange ? (
          <Text style={styles.error}>Enter a duration between 1 and {MAX_MINUTES} minutes.</Text>
        ) : null}
      </View>

      <View>
        <Text style={styles.label}>How hard?</Text>
        <View style={styles.quickRow}>
          {WORKOUT_INTENSITIES.map((value) => {
            const selected = value === intensity;
            return (
              <Pressable
                key={value}
                onPress={() => setIntensity(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.quick, selected && styles.quickSelected]}
              >
                <Text style={[styles.quickText, selected && styles.quickTextSelected]}>
                  {INTENSITY_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
          <Text style={styles.saveText}>Save Workout</Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.white,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  quickSelected: {
    backgroundColor: colors.primarySurface,
  },
  quickText: {
    ...typography.label,
    color: colors.text.secondary,
  },
  quickTextSelected: {
    color: colors.primary,
  },
  minutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    width: 96,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  unit: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  error: {
    ...typography.micro,
    color: colors.danger,
    marginTop: spacing.xs,
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
