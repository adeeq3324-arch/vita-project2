import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { ConditionCard } from '@/components/onboarding/ConditionCard';
import { Button } from '@/components/ui/Button';
import { conditionOptions } from '@/constants/profileOptions';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HealthConditions'>;

export function HealthConditionsScreen({ navigation }: Props) {
  const { data, toggleCondition } = useOnboarding();

  return (
    <Screen>
      <BackButton />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Do you have any{'\n'}health conditions?</Text>
        <Text style={styles.subheading}>Select all that apply</Text>

        <View style={styles.grid}>
          {conditionOptions.map((item) => (
            <View key={item.condition} style={styles.gridItem}>
              <ConditionCard
                label={item.label}
                icon={item.icon}
                accent={item.accent}
                selected={data.conditions.includes(item.condition)}
                onPress={() => toggleCondition(item.condition)}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <Button
        label="Next"
        disabled={data.conditions.length === 0}
        accessibilityHint="Select at least one option to continue"
        onPress={() => navigation.navigate('UserInformation')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heading: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subheading: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  gridItem: {
    // Two equal columns: a basis under 50% leaves room for the `gap` gutter,
    // and flexGrow reclaims the remainder so both columns stay equal width.
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
  },
});
