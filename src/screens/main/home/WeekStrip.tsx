import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

/** Diameter of each day's date circle. */
const CIRCLE = 38;

/** Weekday labels indexed by `Date.getDay()` (0 = Sunday). */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Rotating accent palette for the dotted date rings — one colour per column,
 * matching the design's Sat → Fri sweep. The selected day ignores this and
 * uses the dark pill instead.
 */
const RING_COLORS = [
  colors.accent.pink,
  colors.accent.cyan,
  colors.accent.orange,
  colors.warning,
  colors.accent.green,
  colors.accent.violet,
  colors.accent.neutral,
] as const;

type WeekStripProps = {
  /** Day to highlight. Defaults to today. */
  selected?: Date;
  onSelect?: (day: Date) => void;
};

/**
 * Horizontal week selector shown at the top of Home: seven days (Saturday →
 * Friday) with colour-coded dotted date rings and a dark pill on the selected
 * day. The week tracks the selected date, so it always frames the active day.
 */
export function WeekStrip({ selected, onSelect }: WeekStripProps) {
  const [internal, setInternal] = useState(() => selected ?? new Date());
  const active = selected ?? internal;

  const week = useMemo(() => buildWeek(active), [active]);

  const handleSelect = (day: Date) => {
    if (selected == null) setInternal(day);
    onSelect?.(day);
  };

  return (
    <Card padding="sm">
      <View style={styles.row}>
        {week.map((day, index) => {
          const isSelected = isSameDay(day, active);
          const label = WEEKDAY_LABELS[day.getDay()];
          const date = String(day.getDate()).padStart(2, '0');

          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => handleSelect(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label} ${date}`}
              style={styles.day}
            >
              <View style={[styles.column, isSelected && styles.columnSelected]}>
                <Text style={[styles.label, isSelected && styles.labelSelected]}>{label}</Text>

                <View style={styles.circleWrap}>
                  {isSelected ? (
                    <View style={styles.circleSelected}>
                      <Text style={styles.dateSelected}>{date}</Text>
                    </View>
                  ) : (
                    <>
                      <DottedRing color={RING_COLORS[index % RING_COLORS.length]!} />
                      <Text style={styles.date}>{date}</Text>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** A thin dotted circle drawn with SVG so the dots render crisply on both platforms. */
function DottedRing({ color }: { color: string }) {
  const strokeWidth = 1.75;
  const r = (CIRCLE - strokeWidth) / 2;

  return (
    <Svg width={CIRCLE} height={CIRCLE} style={StyleSheet.absoluteFill}>
      <Circle
        cx={CIRCLE / 2}
        cy={CIRCLE / 2}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="0.5 5"
        fill="none"
      />
    </Svg>
  );
}

/** Seven days framing `reference`, starting on the Saturday of its week. */
function buildWeek(reference: Date): Date[] {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  // Days elapsed since the most recent Saturday (getDay: 0 = Sun … 6 = Sat).
  const sinceSaturday = (start.getDay() + 1) % 7;
  start.setDate(start.getDate() - sinceSaturday);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.full,
  },
  columnSelected: {
    backgroundColor: colors.text.primary,
  },
  label: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  labelSelected: {
    color: colors.text.inverse,
  },
  circleWrap: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    ...typography.label,
    color: colors.text.primary,
  },
  circleSelected: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSelected: {
    ...typography.label,
    color: colors.text.inverse,
  },
});
