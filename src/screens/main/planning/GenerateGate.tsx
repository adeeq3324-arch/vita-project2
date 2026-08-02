import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, typography } from '@/theme';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

type GenerateGateProps = {
  icon: Glyph;
  /** Domain colours of the plan being generated. */
  tint: { color: string; surface: string; dark: string };
  title: string;
  description: string;
  points: string[];
  loading: boolean;
  /** Why the last attempt failed, when one did. */
  error?: string | null;
  onGenerate: () => void;
};

/**
 * The state a plan screen is in before it has a plan: what will be built, what
 * it will be built from, and the one button that starts it.
 *
 * Generation takes real time and real money, so the gate says plainly what the
 * plan is made of before asking for it — a user who understands that it comes
 * from their goal and their conditions is a user who will not tap it twice
 * expecting a different answer.
 */
export function GenerateGate({
  icon,
  tint,
  title,
  description,
  points,
  loading,
  error,
  onGenerate,
}: GenerateGateProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { backgroundColor: tint.surface }]}>
          <MaterialCommunityIcons name={icon} size={48} color={tint.color} />
        </View>

        <View style={styles.aiTag}>
          <MaterialCommunityIcons name="star-four-points" size={12} color={colors.primary} />
          <Text style={styles.aiTagText}>AI powered</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.points}>
          {points.map((point) => (
            <View key={point} style={styles.point}>
              <MaterialCommunityIcons name="check-circle" size={16} color={tint.dark} />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.error}>
            <Feather name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={loading ? 'Generating…' : error ? 'Try again' : 'Generate with AI'}
          loading={loading}
          onPress={onGenerate}
          accessibilityHint="Builds your personalised plan from your profile and goal"
        />
        <Text style={styles.caption}>
          {loading
            ? 'Personalizing to your goal — this takes a moment…'
            : 'Built from your goal, profile and health conditions'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing['3xl'],
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  hero: {
    width: 104,
    height: 104,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  aiTagText: {
    ...typography.micro,
    color: colors.primary,
  },
  title: {
    ...typography.h2,
    color: colors.plan.ink,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  points: {
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.base,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pointText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  errorText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingTop: spacing.base,
  },
  caption: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
