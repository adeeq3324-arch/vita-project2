import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { Button } from '@/components/ui/Button';
import { goalOptions } from '@/constants/profileOptions';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'GoalSelection'>;

export function GoalSelectionScreen({ navigation }: Props) {
  const { data, setGoal } = useOnboarding();

  return (
    <Screen>
      <BackButton />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>What is your{'\n'}primary goal?</Text>
        <Text style={styles.subheading}>This helps us personalize{'\n'}your experience</Text>

        <View style={styles.cards} accessibilityRole="radiogroup">
          {goalOptions.map((item) => (
            <GoalCard
              key={item.goal}
              goal={item.goal}
              title={item.title}
              description={item.description}
              selected={data.goal === item.goal}
              onPress={() => setGoal(item.goal)}
            />
          ))}
        </View>
      </ScrollView>

      <Button
        label="Next"
        disabled={data.goal === null}
        accessibilityHint="Select a goal to continue"
        onPress={() => navigation.navigate('HealthConditions')}
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
  cards: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
