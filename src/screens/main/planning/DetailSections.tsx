import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * The blocks the two plan detail screens are built from.
 *
 * They live together because they are one visual family — a heading, a body, and
 * a tint that tells the reader what kind of thing they are looking at. Written
 * once so a benefit list and a caution list can never drift into looking like
 * the same weight of statement.
 */

/**
 * The model's own reasoning, in its own tinted card.
 *
 * Set apart from the factual sections deliberately. Everything else on a detail
 * screen is a number or a claim about the substance; this is the plan explaining
 * a choice it made, and presenting the two identically would invite the reader to
 * trust them equally.
 */
export function InsightCard({
  title,
  body,
  tint,
}: {
  title: string;
  body: string;
  tint: { surface: string; dark: string };
}) {
  return (
    <View style={[styles.insight, { backgroundColor: tint.surface }]}>
      <View style={styles.insightHeader}>
        <MaterialCommunityIcons name="star-four-points" size={15} color={tint.dark} />
        <Text style={[styles.insightTitle, { color: tint.dark }]}>{title}</Text>
      </View>
      <Text style={styles.insightBody}>{body}</Text>
    </View>
  );
}

/**
 * The supplement facts panel: what one serving is, and what is in it.
 *
 * Laid out as a label is — substance on the left, amount right-aligned on the
 * right — because that is the form the reader will be comparing it against when
 * they have a tub in their hand. The amounts describe the product, never a
 * quantity to take; the recommendation below the fold is where the question of
 * how much belongs.
 */
export function IngredientsSection({
  servingSize,
  ingredients,
}: {
  servingSize: string;
  ingredients: readonly { name: string; amount: string }[];
}) {
  if (ingredients.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ingredients</Text>
      {servingSize ? <Text style={styles.serving}>Per {servingSize}</Text> : null}

      <View style={styles.panel}>
        {ingredients.map((entry, index) => (
          <View
            key={entry.name}
            style={[styles.panelRow, index > 0 && styles.panelRowDivided]}
          >
            <Text style={styles.panelName}>{entry.name}</Text>
            <Text style={styles.panelAmount}>{entry.amount}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A titled block of prose: Purpose. */
export function ProseSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

/** A titled list of short, positive claims, ticked. */
export function ChecklistSection({
  title,
  items,
  tint,
}: {
  title: string;
  items: string[];
  tint: string;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listRow}>
            <MaterialCommunityIcons name="check" size={15} color={tint} style={styles.listIcon} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Cautions, in the one treatment on the screen that is allowed to look like a
 * warning.
 *
 * Rendered even when the list is short, and never collapsed behind a tap: a
 * caution a user has to go looking for is a caution the product has decided not
 * to give them.
 */
export function SafetySection({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.safety}>
      <View style={styles.safetyHeader}>
        <MaterialCommunityIcons name="shield-alert" size={16} color={colors.danger} />
        <Text style={styles.safetyTitle}>Safety Information</Text>
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listRow}>
            <View style={styles.bullet} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The facts a plan item is headed by, in one tinted strip. Sized to share the
 * width evenly, so the strip reads the same whether it carries one or several.
 */
export function FactStrip({
  facts,
  tint,
}: {
  facts: readonly { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }[];
  tint: { surface: string; dark: string };
}) {
  return (
    <View style={[styles.facts, { backgroundColor: tint.surface }]}>
      {facts.map((fact, index) => (
        <View key={fact.label} style={styles.factRow}>
          {index > 0 ? <View style={styles.factDivider} /> : null}
          <View style={styles.fact}>
            <View style={styles.factHeader}>
              <MaterialCommunityIcons name={fact.icon} size={14} color={tint.dark} />
              <Text style={styles.factValue} numberOfLines={1}>
                {fact.value}
              </Text>
            </View>
            <Text style={styles.factLabel}>{fact.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** One nutrient in the detail hero's stat row. */
export function StatCell({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** The row of nutrient stats under a meal's title. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <Card style={styles.statRow}>{children}</Card>;
}

const styles = StyleSheet.create({
  insight: {
    borderRadius: radius.base,
    padding: spacing.base,
    gap: spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  insightTitle: {
    ...typography.label,
  },
  insightBody: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  sectionBody: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  serving: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: -spacing.xs,
  },
  panel: {
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  panelRowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  panelName: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  panelAmount: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  list: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  listIcon: {
    marginTop: 2,
  },
  listText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 21,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    marginTop: 8,
  },
  safety: {
    borderRadius: radius.base,
    padding: spacing.base,
    gap: spacing.md,
    backgroundColor: colors.dangerSurface,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  safetyTitle: {
    ...typography.label,
    color: colors.danger,
  },
  facts: {
    flexDirection: 'row',
    borderRadius: radius.base,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  factRow: {
    flex: 1,
    flexDirection: 'row',
  },
  fact: {
    flex: 1,
    gap: 3,
  },
  factHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  factValue: {
    ...typography.label,
    color: colors.plan.ink,
    flexShrink: 1,
  },
  factLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  factDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.borderStrong,
    marginRight: spacing.base,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  statLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});
