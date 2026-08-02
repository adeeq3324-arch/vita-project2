import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { RecipeStep } from '@/services/planning/planningService';

import { formatMinutes } from './RecipeTimeCard';

/**
 * The method, as a timeline you can hold your place in.
 *
 * Every step is tappable and stays marked, joined by a rail down the left, which
 * is the whole point: a person cooking looks away from their phone constantly,
 * and the question they come back with is always "which one was I on". A
 * numbered wall of paragraphs cannot answer that, so this does.
 *
 * Marks are local to the session, like the ingredient ticks — coming back
 * tomorrow to a recipe that claims you already browned the onions is worse than
 * coming back to a clean one.
 */
export function RecipeSteps({ steps }: { steps: readonly RecipeStep[] }) {
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = useCallback((stepNumber: number) => {
    setDone((current) => {
      const next = new Set(current);
      if (!next.delete(stepNumber)) next.add(stepNumber);
      return next;
    });
  }, []);

  if (steps.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Cooking Instructions</Text>
          <Text style={styles.subtitle}>
            {steps.length} steps · tap one when it is done
          </Text>
        </View>
        <Text style={styles.counter}>
          {done.size}/{steps.length}
        </Text>
      </View>

      <View>
        {steps.map((step, index) => (
          <StepRow
            key={step.number}
            step={step}
            checked={done.has(step.number)}
            last={index === steps.length - 1}
            onToggle={() => toggle(step.number)}
          />
        ))}
      </View>
    </View>
  );
}

function StepRow({
  step,
  checked,
  last,
  onToggle,
}: {
  step: RecipeStep;
  checked: boolean;
  /** The rail stops here, so the timeline ends on the last step rather than running past it. */
  last: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Step ${step.number}: ${step.title}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rail}>
        <View style={[styles.marker, checked && styles.markerDone]}>
          {checked ? (
            <MaterialCommunityIcons name="check" size={15} color={colors.white} />
          ) : (
            <Text style={styles.markerText}>{step.number}</Text>
          )}
        </View>
        {last ? null : <View style={[styles.line, checked && styles.lineDone]} />}
      </View>

      {/*
        A finished step keeps its full space so the rail stays aligned with the
        copy beside it, and says it is finished through its ink alone.
      */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.stepTitle, checked && styles.faded]} numberOfLines={2}>
            {step.title}
          </Text>
          {step.minutes !== null ? (
            <View style={styles.timeBadge}>
              <MaterialCommunityIcons
                name="timer-outline"
                size={11}
                color={colors.plan.mealDark}
              />
              <Text style={styles.timeText}>{formatMinutes(step.minutes)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.instruction, checked && styles.faded]}>{step.instruction}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  counter: {
    ...typography.label,
    color: colors.plan.mealDark,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  rail: {
    alignItems: 'center',
    width: 28,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plan.mealSurface,
  },
  markerDone: {
    backgroundColor: colors.plan.meal,
  },
  markerText: {
    ...typography.label,
    color: colors.plan.mealDark,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.divider,
    marginVertical: spacing.xs,
  },
  lineDone: {
    backgroundColor: colors.plan.mealSurface,
  },
  card: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 28,
  },
  stepTitle: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
    flex: 1,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.plan.mealSurface,
  },
  timeText: {
    ...typography.micro,
    color: colors.plan.mealDark,
  },
  instruction: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  faded: {
    color: colors.text.disabled,
  },
});
