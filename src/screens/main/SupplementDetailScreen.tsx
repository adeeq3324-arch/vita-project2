import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { usePlan } from '@/context/PlanContext';
import { planningService } from '@/services';
import { colors, layout, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';
import type { PlannedSupplement } from '@/services/planning/planningService';

import { AddToStackButton } from './planning/AddToStackButton';
import {
  ChecklistSection,
  FactStrip,
  IngredientsSection,
  InsightCard,
  ProseSection,
  SafetySection,
} from './planning/DetailSections';
import { PlanImage } from './planning/PlanImage';
import { TierBadge } from './planning/TierBadge';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementDetail'>;

const SUPPLEMENT_TINT = {
  surface: colors.plan.supplementSurface,
  dark: colors.plan.supplementDark,
};

export function SupplementDetailScreen({ route }: Props) {
  const { supplementPlanId, supplementId } = route.params;
  const { supplement: plan } = usePlan();
  const insets = useSafeAreaInsets();

  // The plan in memory is the fastest correct answer; the fetch below only runs
  // when this screen was reached without it.
  const cached = plan.data?.items.find((item) => item.id === supplementId);

  const [item, setItem] = useState<PlannedSupplement | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to ask for the supplement again after a failed read. */
  const [attempt, setAttempt] = useState(0);

  // Only runs when the plan was not already in memory — a deep link, or a plan
  // that arrived after this screen mounted.
  useEffect(() => {
    if (item) return undefined;
    let active = true;

    void (async () => {
      try {
        const fetched = await planningService.getPlannedSupplement(supplementPlanId, supplementId);
        if (active) setItem(fetched);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'This supplement could not be loaded.');
      }
    })();

    return () => {
      active = false;
    };
  }, [supplementPlanId, supplementId, item, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((count) => count + 1);
  }, []);

  if (!item) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <DetailHeader title="Supplement" />
        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <LoadingState label="Loading this supplement…" />
        )}
      </Screen>
    );
  }

  return (
    <View style={styles.screen}>
      <Screen edges={{ top: true, bottom: false }} style={styles.headerHost}>
        <DetailHeader title={item.name} />
      </Screen>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <PlanImage
            uri={item.imageUrl}
            icon="pill"
            tint={{ surface: colors.plan.supplementSurface, color: colors.plan.supplementDark }}
            iconSize={72}
            style={styles.heroImage}
            accessibilityLabel={item.name}
          />
          <View style={styles.heroBadge}>
            <TierBadge tier={item.tier} />
          </View>
        </View>

        <View style={styles.identity}>
          <Text style={styles.name}>{item.name}</Text>
          {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
          {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
          {item.rating !== null ? (
            <Rating value={item.rating} count={item.ratingCount} />
          ) : null}
        </View>

        <FactStrip
          tint={SUPPLEMENT_TINT}
          facts={[{ icon: 'clock-outline', label: 'Best Time', value: item.bestTimeLabel }]}
        />

        <ProseSection title="Purpose" body={item.purpose} />
        <ChecklistSection
          title="Benefits"
          items={item.benefits}
          tint={colors.plan.supplementDark}
        />
        <IngredientsSection servingSize={item.servingSize} ingredients={item.ingredients} />
        <SafetySection items={item.safety} />

        {/*
          Last on the screen, and deliberately so. Everything above describes the
          substance; this is the one thing the reader has to do before acting on
          any of it, and it sits where they arrive after reading the rest rather
          than where they would scroll past it on the way in.
        */}
        {item.recommendation ? (
          <InsightCard
            title="Before you start"
            body={item.recommendation}
            tint={SUPPLEMENT_TINT}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
        <AddToStackButton supplement={item} />
      </View>
    </View>
  );
}

/**
 * A product rating, shown only when a real catalogue supplied one.
 *
 * Never generated: a star count is a claim about what other people thought, and
 * there is nothing to base one on until the platform has a catalogue behind it.
 */
function Rating({ value, count }: { value: number; count: number | null }) {
  return (
    <View style={styles.rating}>
      <MaterialCommunityIcons name="star" size={14} color={colors.warning} />
      <Text style={styles.ratingValue}>{value.toFixed(1)}</Text>
      {count !== null ? (
        <Text style={styles.ratingCount}>({count.toLocaleString()})</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerHost: {
    flex: 0,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  hero: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'flex-start',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroBadge: {
    alignSelf: 'flex-end',
    margin: spacing.md,
  },
  identity: {
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
    color: colors.plan.ink,
  },
  brand: {
    ...typography.label,
    color: colors.plan.supplementDark,
  },
  category: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  ratingValue: {
    ...typography.label,
    color: colors.plan.ink,
  },
  ratingCount: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
