import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, LoadingState } from '@/components/ui/StateView';
import { usePlan } from '@/context/PlanContext';
import { colors, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

import { GenerateGate } from './planning/GenerateGate';
import { PlanBanner } from './planning/PlanBanner';
import { PlanHeader } from './planning/PlanHeader';
import { SupplementCard } from './planning/SupplementCard';
import { TierFilter, type TierFilterValue } from './planning/TierFilter';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementPlan'>;

const SUPPLEMENT_TINT = {
  color: colors.plan.supplement,
  surface: colors.plan.supplementSurface,
  dark: colors.plan.supplementDark,
};

export function SupplementPlanScreen({ navigation }: Props) {
  const { supplement, hydrating, generate, refresh } = usePlan();
  const [tier, setTier] = useState<TierFilterValue>('all');
  const [refreshing, setRefreshing] = useState(false);

  const plan = supplement.data;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh('supplement');
    } finally {
      setRefreshing(false);
    }
  };

  if (hydrating) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <PlanHeader title="Supplements Plan" subtitle="This month" />
        <LoadingState label="Loading your stack…" />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <PlanHeader title="Supplements Plan" subtitle="This month" />
        <GenerateGate
          icon="pill"
          tint={SUPPLEMENT_TINT}
          title="Your AI Supplement Plan"
          description="A short, well-justified stack for the month ahead, matched to your goal and checked against the conditions on your health profile."
          points={[
            'Only what your goal actually calls for',
            'When to take each one, and for how long',
            'The cautions that come with it',
          ]}
          loading={supplement.status === 'generating'}
          error={supplement.error}
          onGenerate={() => void generate('supplement')}
        />
      </Screen>
    );
  }

  const items = tier === 'all' ? plan.items : plan.items.filter((item) => item.tier === tier);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <PlanHeader
        title="Supplements Plan"
        subtitle={plan.monthLabel}
        regenerating={supplement.status === 'generating'}
        onRegenerate={() => void generate('supplement')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.plan.supplement}
          />
        }
      >
        <PlanBanner
          title="Your supplement plan is ready"
          subtitle="Personalized stack to support your goals"
          tint={colors.plan.supplement}
        />

        <TierFilter value={tier} onChange={setTier} counts={plan.counts} />

        {items.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Nothing in this group"
            message="Your plan has no supplements in this category."
          />
        ) : (
          items.map((item) => (
            <SupplementCard
              key={item.id}
              supplement={item}
              onPress={() =>
                navigation.navigate('SupplementDetail', {
                  supplementPlanId: plan.supplementPlanId,
                  supplementId: item.id,
                })
              }
            />
          ))
        )}

        <Text style={styles.note}>
          General wellness guidance, not medical advice. Check with a healthcare provider before
          starting anything new — especially if you take medication.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing['4xl'],
  },
  note: {
    ...typography.micro,
    color: colors.text.tertiary,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
