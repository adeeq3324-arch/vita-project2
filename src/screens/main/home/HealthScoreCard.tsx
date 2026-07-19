import { StyleSheet, Text, View } from 'react-native';

import { CircularGauge } from '@/components/charts/CircularGauge';
import { Sparkline } from '@/components/charts/Sparkline';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

import { healthScore } from './homeData';

/**
 * Hero card: the Health Score gauge on the left, an encouraging message and a
 * trend sparkline on the right.
 */
export function HealthScoreCard() {
  return (
    <Card>
      <Text style={styles.title}>Health Score</Text>
      <View style={styles.body}>
        <CircularGauge
          value={healthScore.value}
          caption={healthScore.caption}
          size={116}
        />
        <View style={styles.side}>
          <Text style={styles.message}>{healthScore.message}</Text>
          <Sparkline data={healthScore.trend} width={140} height={44} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    marginLeft: spacing.base,
    gap: spacing.sm,
  },
  message: {
    ...typography.bodyStrong,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
