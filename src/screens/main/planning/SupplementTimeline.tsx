import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { Supplement } from '@/services/ai';

/**
 * Daily supplement schedule as a timeline: time on the left, a connected node,
 * and the supplement name + timing. Each row opens its detail.
 */
export function SupplementTimeline({
  supplements,
  onSelect,
}: {
  supplements: Supplement[];
  onSelect: (id: string) => void;
}) {
  return (
    <View>
      {supplements.map((supplement, index) => {
        const last = index === supplements.length - 1;
        return (
          <Pressable
            key={supplement.id}
            onPress={() => onSelect(supplement.id)}
            accessibilityRole="button"
            accessibilityLabel={`${supplement.name} at ${supplement.time}, ${supplement.timing}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.time}>{supplement.time}</Text>

            <View style={styles.rail}>
              <View style={styles.node}>
                <View style={styles.nodeDot} />
              </View>
              {!last ? <View style={styles.line} /> : null}
            </View>

            <View style={[styles.icon, { backgroundColor: colors.accentSurface[supplement.accent] }]}>
              <MaterialCommunityIcons name={supplement.icon} size={18} color={colors.accent[supplement.accent]} />
            </View>

            <View style={styles.copy}>
              <Text style={styles.name}>{supplement.name}</Text>
              <Text style={styles.timing}>{supplement.timing}</Text>
            </View>

            <Feather name="chevron-right" size={18} color={colors.text.disabled} />
          </Pressable>
        );
      })}
    </View>
  );
}

const NODE = 18;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  time: {
    width: 64,
    ...typography.label,
    color: colors.text.secondary,
  },
  rail: {
    width: NODE,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  nodeDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  copy: {
    flex: 1,
    marginTop: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  timing: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
