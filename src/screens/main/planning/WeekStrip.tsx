import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { MealPlanDay } from '@/services/planning/planningService';

type WeekStripProps = {
  days: MealPlanDay[];
  selectedDayOfWeek: number;
  onSelect: (dayOfWeek: number) => void;
  /** Today's calendar date (YYYY-MM-DD), so the strip can mark it. */
  today: string;
};

/**
 * The seven-day selector at the top of a meal plan.
 *
 * Days are labelled with their weekday *and* their date. A plan covers a
 * specific week, and "Mon" alone leaves the user to work out whether they are
 * looking at this Monday or the one the plan was generated for.
 *
 * The seven cells share the width equally rather than scrolling horizontally. A
 * week is a fixed, known quantity — Sunday is not somewhere off-screen to be
 * discovered — so the strip spans edge to edge and every day is one tap away.
 */
export function WeekStrip({ days, selectedDayOfWeek, onSelect, today }: WeekStripProps) {
  return (
    <View style={styles.strip}>
      {days.map((day) => {
        const selected = day.dayOfWeek === selectedDayOfWeek;
        const isToday = day.date === today;

        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.dayOfWeek)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${day.dayName} ${dayNumber(day.date)}${isToday ? ', today' : ''}`}
            style={[styles.day, selected && styles.daySelected]}
          >
            <Text style={[styles.weekday, selected && styles.textSelected]}>
              {day.dayName.slice(0, 3)}
            </Text>
            <Text style={[styles.date, selected && styles.textSelected]}>
              {dayNumber(day.date)}
            </Text>
            <View
              style={[
                styles.dot,
                isToday && styles.dotVisible,
                isToday && selected && styles.dotOnSelected,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** The day-of-month a `YYYY-MM-DD` date falls on, without a leading zero. */
function dayNumber(date: string): string {
  return String(Number(date.slice(8, 10)));
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    // Tighter than the usual rhythm on purpose: seven cells plus six gaps have
    // to fit the narrowest phone without any of them collapsing.
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  day: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.base,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceMuted,
  },
  daySelected: {
    backgroundColor: colors.plan.meal,
  },
  weekday: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  date: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  textSelected: {
    color: colors.white,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    marginTop: 2,
    backgroundColor: colors.transparent,
  },
  dotVisible: {
    backgroundColor: colors.plan.meal,
  },
  dotOnSelected: {
    backgroundColor: colors.white,
  },
});
