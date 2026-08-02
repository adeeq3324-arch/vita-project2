import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { create as createReminder, list as listReminders, type Reminder } from '@/services/reminders/remindersService';
import { colors, radius, spacing, typography } from '@/theme';
import type { PlannedSupplement, SupplementTime } from '@/services/planning/planningService';

import { formatClockTime } from './mealTime';

/**
 * Default clock time for each timing slot.
 *
 * A regimen says "post-workout"; a reminder has to say "19:00". These are the
 * ordinary reading of each slot for someone with an ordinary day, and every one
 * of them is editable in Reminders afterwards — the point is to turn an
 * intention into something that will actually fire, not to guess a routine the
 * platform has not been told about.
 */
const DEFAULT_TIME: Record<SupplementTime, string> = {
  morning: '08:00',
  withMeal: '13:00',
  afternoon: '15:00',
  preWorkout: '17:00',
  postWorkout: '19:00',
  evening: '19:30',
  beforeBed: '22:00',
};

/**
 * Commits the user to a supplement by putting it in their reminders.
 *
 * "Adding to my stack" has to mean something the app will still be doing
 * tomorrow morning, and a list the user has to remember to open is not that. A
 * daily reminder at the suggested time is the smallest real version of the
 * promise the button makes, and the caption says exactly what will happen before
 * it is tapped.
 */
export function AddToStackButton({ supplement }: { supplement: PlannedSupplement }) {
  const [existing, setExisting] = useState<Reminder | null>(null);
  const [checking, setChecking] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const time = DEFAULT_TIME[supplement.bestTime] ?? '08:00';

  // Whether it is already in the stack is not something the screen can know from
  // the plan: reminders are their own resource, and one may have been added on
  // another device or on a previous visit.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const reminders = await listReminders('all');
        if (!active) return;
        setExisting(reminders.find((reminder) => matches(reminder, supplement.name)) ?? null);
      } catch {
        // Not knowing is not worth an error: the button stays available, and a
        // duplicate is a far smaller problem than a blocked action.
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supplement.name]);

  const onAdd = useCallback(async () => {
    setAdding(true);
    setError(null);
    try {
      setExisting(
        await createReminder({
          name: supplement.name,
          category: 'supplement',
          time,
          message: `Time for your ${supplement.name} — ${supplement.headline || supplement.purpose}`,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'This could not be added to your reminders. Try again.',
      );
    } finally {
      setAdding(false);
    }
  }, [supplement.name, supplement.headline, supplement.purpose, time]);

  if (existing) {
    return (
      <View style={styles.done}>
        <Feather name="check-circle" size={16} color={colors.success} />
        <Text style={styles.doneText}>
          In your stack — reminder set for {existing.timeLabel}, {existing.repeat.toLowerCase()}.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={adding ? 'Adding…' : 'Add to My Stack'}
        loading={adding}
        disabled={checking}
        onPress={() => void onAdd()}
        accessibilityHint={`Adds a daily reminder to take ${supplement.name}`}
      />
      <Text style={styles.caption}>
        Sets a daily reminder at {formatClockTime(time)}. Change it any time in Reminders.
      </Text>
    </View>
  );
}

/** A reminder already standing for this supplement, whatever its casing. */
function matches(reminder: Reminder, name: string): boolean {
  return (
    reminder.category === 'supplement' &&
    reminder.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  caption: {
    ...typography.micro,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successSurface,
  },
  doneText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
});
