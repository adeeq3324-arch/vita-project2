import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, typography, type AccentName } from '@/theme';
import type { AIIcon } from '@/services/ai/types';

type GenerateGateProps = {
  icon: AIIcon;
  accent: AccentName;
  title: string;
  description: string;
  points: string[];
  loading: boolean;
  onGenerate: () => void;
};

/**
 * Empty state shown before a plan is generated: a hero glyph, an "AI" tag, a
 * short description of what will be built, and the Generate CTA. While the plan
 * generates the button shows a spinner and a personalising caption.
 */
export function GenerateGate({ icon, accent, title, description, points, loading, onGenerate }: GenerateGateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <View style={[styles.hero, { backgroundColor: colors.accentSurface[accent] }]}>
          <MaterialCommunityIcons name={icon} size={48} color={colors.accent[accent]} />
        </View>

        <View style={styles.aiTag}>
          <MaterialCommunityIcons name="robot-happy" size={13} color={colors.primary} />
          <Text style={styles.aiTagText}>AI powered</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.points}>
          {points.map((point) => (
            <View key={point} style={styles.point}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label={loading ? 'Generating…' : 'Generate with AI'}
          loading={loading}
          onPress={onGenerate}
          accessibilityHint="Builds your personalised plan from your profile and goal"
        />
        {loading ? (
          <Text style={styles.caption}>Personalizing to your goal…</Text>
        ) : (
          <Text style={styles.caption}>Built from your goal, profile and health conditions</Text>
        )}
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
    flex: 1,
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
    color: colors.text.primary,
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
  footer: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  caption: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
