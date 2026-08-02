import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useFoodDiary } from '@/context/FoodDiaryContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { analyzeProduct } from '@/services/ai';
import { colors, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'BarcodeResult'>;

export function BarcodeResultScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const { addMeal } = useFoodDiary();
  const product = analyzeProduct(data);

  const macro = (label: string) => product.nutrients.find((n) => n.label === label)?.value ?? 0;

  // Persisted, so navigation waits for the write to land — see FoodScanResult.
  const addToDiary = async () => {
    try {
      await addMeal({
        name: product.name,
        kcal: macro('Calories'),
        protein: macro('Protein'),
        carbs: macro('Carbs'),
        fat: macro('Fat'),
        icon: product.icon,
        accent: product.accent,
      });
      navigation.navigate('FoodTracking');
    } catch (error) {
      Alert.alert(
        'Could not log that product',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Product Details" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card style={styles.headCard}>
          <View style={[styles.thumb, { backgroundColor: colors.accentSurface[product.accent] }]}>
            <MaterialCommunityIcons name={product.icon} size={40} color={colors.accent[product.accent]} />
          </View>
          <View style={styles.headCopy}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.brand}>{product.brand}</Text>
            <View style={styles.rating}>
              <Text style={styles.ratingValue}>
                {product.rating}
                <Text style={styles.ratingMax}>/10</Text>
              </Text>
              <View style={styles.ratingPill}>
                <Text style={styles.ratingLabel}>{product.ratingLabel}</Text>
              </View>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Nutrition Per Serving</Text>
          <View style={styles.grid}>
            {product.nutrients.map((nutrient) => (
              <View key={nutrient.label} style={styles.gridCell}>
                <Text style={styles.gridValue}>
                  {nutrient.value}
                  <Text style={styles.gridUnit}> {nutrient.unit}</Text>
                </Text>
                <Text style={styles.gridLabel}>{nutrient.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <Text style={styles.ingredients}>{product.ingredients}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Health Insights</Text>
          <View style={styles.insights}>
            {product.insights.map((insight) => (
              <View key={insight.text} style={styles.insightRow}>
                <MaterialCommunityIcons
                  name={insight.positive ? 'check-circle' : 'alert-circle'}
                  size={18}
                  color={insight.positive ? colors.success : colors.warning}
                />
                <Text style={styles.insightText}>{insight.text}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View>
          <Text style={styles.altTitle}>Better Alternatives</Text>
          <View style={styles.altRow}>
            {product.alternatives.map((alt) => (
              <Card key={alt.name} padding="sm" style={styles.altCard}>
                <View style={styles.altThumb}>
                  <MaterialCommunityIcons name="nutrition" size={24} color={colors.primary} />
                </View>
                <Text style={styles.altName} numberOfLines={2}>
                  {alt.name}
                </Text>
                <Text style={styles.altBrand} numberOfLines={1}>
                  {alt.brand}
                </Text>
                <View style={styles.altRating}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.warning} />
                  <Text style={styles.altRatingText}>{alt.rating}/10</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        <Button label="Add to Diary" onPress={addToDiary} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  headCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: { flex: 1 },
  name: {
    ...typography.h3,
    color: colors.text.primary,
  },
  brand: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ratingValue: {
    ...typography.h3,
    color: colors.success,
  },
  ratingMax: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  ratingPill: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  ratingLabel: {
    ...typography.micro,
    color: colors.success,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '33.33%',
    paddingVertical: spacing.sm,
  },
  gridValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  gridUnit: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  gridLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  ingredients: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  insights: {
    gap: spacing.md,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  insightText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  altTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  altRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  altCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  altThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  altName: {
    ...typography.label,
    color: colors.text.primary,
    textAlign: 'center',
  },
  altBrand: {
    ...typography.micro,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  altRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  altRatingText: {
    ...typography.micro,
    color: colors.text.secondary,
  },
});
