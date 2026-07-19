import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

import { tips } from './progressData';

/** Tips view of the Progress tab: personalised coaching cards. */
export function TipsList() {
  return (
    <View style={styles.list}>
      {tips.map((tip) => (
        <Card key={tip.key} style={styles.card}>
          <View style={[styles.icon, { backgroundColor: tip.color + '1A' }]}>
            <MaterialCommunityIcons name={tip.icon} size={22} color={tip.color} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{tip.title}</Text>
            <Text style={styles.body}>{tip.body}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.text.primary,
    marginBottom: 2,
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
