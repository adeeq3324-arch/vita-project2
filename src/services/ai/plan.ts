import type { OnboardingData } from '@/context/OnboardingContext';
import type { MealType } from '@/types';

import { activeConditions, calorieTarget, conditionNote, firstName, goalLabel, proteinTarget } from './profile';
import type {
  AIIcon,
  DayPlan,
  MacroTotals,
  PlannedMeal,
  Supplement,
  SupplementDetail,
  WeekSummary,
} from './types';

/**
 * Meal- and supplement-plan generator. Stands in for the AI service configured
 * in the environment: plans are assembled from the user's goal, calorie target
 * and health conditions so the output is personalised, not hardcoded.
 */

const mealMeta: Record<MealType, { icon: AIIcon; accent: PlannedMeal['accent'] }> = {
  breakfast: { icon: 'coffee', accent: 'orange' },
  lunch: { icon: 'bowl-mix', accent: 'green' },
  dinner: { icon: 'fish', accent: 'cyan' },
  snack: { icon: 'fruit-cherries', accent: 'pink' },
};

type MealTemplate = { name: string; kcal: number; prepMin: number; protein: number; carbs: number; fat: number };

const options: Record<MealType, MealTemplate[]> = {
  breakfast: [
    { name: 'Oatmeal with Berries', kcal: 320, prepMin: 20, protein: 12, carbs: 54, fat: 6 },
    { name: 'Greek Yogurt & Granola', kcal: 300, prepMin: 5, protein: 20, carbs: 38, fat: 8 },
    { name: 'Veggie Omelette', kcal: 340, prepMin: 15, protein: 24, carbs: 10, fat: 22 },
    { name: 'Avocado Toast & Eggs', kcal: 380, prepMin: 12, protein: 18, carbs: 34, fat: 20 },
    { name: 'Protein Smoothie Bowl', kcal: 330, prepMin: 8, protein: 28, carbs: 40, fat: 7 },
    { name: 'Banana Peanut Oats', kcal: 360, prepMin: 10, protein: 14, carbs: 58, fat: 10 },
    { name: 'Cottage Cheese & Fruit', kcal: 290, prepMin: 5, protein: 26, carbs: 30, fat: 6 },
  ],
  lunch: [
    { name: 'Grilled Chicken Salad', kcal: 530, prepMin: 20, protein: 42, carbs: 30, fat: 24 },
    { name: 'Quinoa Power Bowl', kcal: 510, prepMin: 25, protein: 24, carbs: 62, fat: 16 },
    { name: 'Turkey Wrap', kcal: 480, prepMin: 12, protein: 34, carbs: 45, fat: 16 },
    { name: 'Lentil & Veg Curry', kcal: 500, prepMin: 30, protein: 22, carbs: 68, fat: 12 },
    { name: 'Tuna & Rice Bowl', kcal: 540, prepMin: 15, protein: 38, carbs: 58, fat: 12 },
    { name: 'Chickpea Buddha Bowl', kcal: 520, prepMin: 20, protein: 20, carbs: 66, fat: 18 },
    { name: 'Beef & Broccoli', kcal: 560, prepMin: 25, protein: 40, carbs: 40, fat: 22 },
  ],
  dinner: [
    { name: 'Salmon with Quinoa', kcal: 560, prepMin: 25, protein: 40, carbs: 42, fat: 24 },
    { name: 'Grilled Chicken & Veg', kcal: 520, prepMin: 30, protein: 46, carbs: 28, fat: 20 },
    { name: 'Shrimp Stir-Fry', kcal: 490, prepMin: 20, protein: 36, carbs: 44, fat: 14 },
    { name: 'Baked Cod & Potatoes', kcal: 510, prepMin: 35, protein: 38, carbs: 48, fat: 14 },
    { name: 'Tofu & Veg Noodles', kcal: 480, prepMin: 22, protein: 26, carbs: 58, fat: 16 },
    { name: 'Lean Beef Chili', kcal: 540, prepMin: 40, protein: 38, carbs: 46, fat: 18 },
    { name: 'Chicken Fajita Bowl', kcal: 530, prepMin: 25, protein: 42, carbs: 44, fat: 18 },
  ],
  snack: [
    { name: 'Greek Yogurt with Nuts', kcal: 200, prepMin: 10, protein: 16, carbs: 14, fat: 10 },
    { name: 'Apple & Almond Butter', kcal: 210, prepMin: 3, protein: 6, carbs: 26, fat: 12 },
    { name: 'Protein Bar', kcal: 190, prepMin: 1, protein: 20, carbs: 18, fat: 6 },
    { name: 'Hummus & Carrots', kcal: 170, prepMin: 5, protein: 6, carbs: 22, fat: 8 },
    { name: 'Cottage Cheese Cup', kcal: 150, prepMin: 2, protein: 18, carbs: 8, fat: 4 },
    { name: 'Trail Mix', kcal: 220, prepMin: 1, protein: 8, carbs: 20, fat: 14 },
    { name: 'Berries & Dark Chocolate', kcal: 180, prepMin: 3, protein: 4, carbs: 26, fat: 8 },
  ],
};

const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Calorie multiplier so daily totals track the user's target. */
function scale(data: OnboardingData): number {
  const target = calorieTarget(data);
  return target / 2200; // templates sum to ~2200 kcal/day
}

/** The 7-day meal plan, personalised to the user's calorie target. */
export function mealPlan(data: OnboardingData): DayPlan[] {
  const factor = scale(data);
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    day: dayIndex + 1,
    meals: mealOrder.map((type) => {
      const template = options[type][dayIndex % options[type].length]!;
      const meta = mealMeta[type];
      return {
        type,
        name: template.name,
        kcal: Math.round((template.kcal * factor) / 5) * 5,
        prepMin: template.prepMin,
        protein: Math.round(template.protein * factor),
        carbs: Math.round(template.carbs * factor),
        fat: Math.round(template.fat * factor),
        icon: meta.icon,
        accent: meta.accent,
      };
    }),
  }));
}

export function dailyTotals(day: DayPlan): MacroTotals {
  return day.meals.reduce<MacroTotals>(
    (totals, meal) => ({
      kcal: totals.kcal + meal.kcal,
      protein: totals.protein + meal.protein,
      carbs: totals.carbs + meal.carbs,
      fat: totals.fat + meal.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Daily supplement schedule, adjusted for goal and conditions. */
export function supplementSchedule(data: OnboardingData): Supplement[] {
  const base: Supplement[] = [
    { id: 'vitd3', name: 'Vitamin D3', time: '8:00 AM', timing: 'After breakfast', icon: 'weather-sunny', accent: 'orange' },
    { id: 'omega3', name: 'Omega 3', time: '12:00 PM', timing: 'With lunch', icon: 'fish', accent: 'cyan' },
  ];

  if (data.goal === 'muscle_gain') {
    base.push(
      { id: 'creatine', name: 'Creatine Monohydrate', time: '4:00 PM', timing: 'After workout', icon: 'flask', accent: 'violet' },
      { id: 'whey', name: 'Whey Protein', time: '7:00 PM', timing: 'Post workout', icon: 'cup', accent: 'green' },
    );
  } else if (data.goal === 'weight_loss') {
    base.push(
      { id: 'fiber', name: 'Fiber Complex', time: '1:00 PM', timing: 'Before lunch', icon: 'grain', accent: 'green' },
      { id: 'greentea', name: 'Green Tea Extract', time: '3:00 PM', timing: 'Afternoon', icon: 'leaf', accent: 'green' },
    );
  } else {
    base.push({ id: 'multivit', name: 'Multivitamin', time: '9:00 AM', timing: 'With breakfast', icon: 'pill', accent: 'violet' });
  }

  base.push({ id: 'magnesium', name: 'Magnesium', time: '10:00 PM', timing: 'Before sleep', icon: 'moon-waning-crescent', accent: 'violet' });
  return base;
}

const detailCopy: Record<string, Omit<SupplementDetail, 'name' | 'icon' | 'accent'>> = {
  vitd3: {
    purpose: 'Supports bone health, immunity and mood — especially useful with limited sun exposure.',
    bestTime: 'Morning, after breakfast',
    dosage: '2000 IU daily',
    tips: 'Take with a meal containing fat for better absorption.',
  },
  omega3: {
    purpose: 'Provides EPA and DHA to support heart health and reduce inflammation.',
    bestTime: 'Midday, with lunch',
    dosage: '1000 mg daily',
    tips: 'Store in a cool place to keep the oils fresh.',
  },
  creatine: {
    purpose: 'Improves strength, increases muscle mass and supports athletic performance.',
    bestTime: 'After workout',
    dosage: '5 g daily',
    tips: 'Mix with water or your favourite drink and stay well hydrated.',
  },
  whey: {
    purpose: 'A fast, complete protein source to support muscle recovery and growth.',
    bestTime: 'Post workout',
    dosage: '1 scoop (~25 g protein)',
    tips: 'Blend with milk or water; pair with a carb source after training.',
  },
  fiber: {
    purpose: 'Promotes fullness and supports digestion to make a calorie deficit easier.',
    bestTime: 'Before your largest meal',
    dosage: '5 g with water',
    tips: 'Increase water intake to avoid bloating.',
  },
  greentea: {
    purpose: 'Provides antioxidants and may gently support metabolism.',
    bestTime: 'Early afternoon',
    dosage: '400 mg daily',
    tips: 'Avoid late in the day — it contains some caffeine.',
  },
  multivit: {
    purpose: 'Covers everyday micronutrient gaps to support overall wellbeing.',
    bestTime: 'Morning, with breakfast',
    dosage: '1 tablet daily',
    tips: 'Consistency matters more than timing — take it with food.',
  },
  magnesium: {
    purpose: 'Supports muscle relaxation, recovery and better sleep quality.',
    bestTime: 'Evening, before sleep',
    dosage: '300 mg daily',
    tips: 'Take about an hour before bed for the best effect.',
  },
};

/** Detailed, condition-aware guidance for a single supplement. */
export function supplementDetail(id: string, data: OnboardingData): SupplementDetail {
  const supplement = supplementSchedule(data).find((s) => s.id === id) ?? supplementSchedule(data)[0]!;
  const copy = detailCopy[supplement.id] ?? detailCopy.multivit!;
  const note = conditionNote(data);
  return {
    name: supplement.name,
    icon: supplement.icon,
    accent: supplement.accent,
    purpose: note ? `${copy.purpose} ${note}` : copy.purpose,
    bestTime: copy.bestTime,
    dosage: copy.dosage,
    tips: copy.tips,
  };
}

export function weekSummary(data: OnboardingData): WeekSummary {
  return {
    mealsPlanned: 7,
    supplements: supplementSchedule(data).length,
    recipes: 3,
  };
}

/** One-line personalised recommendation for the Planning overview. */
export function aiRecommendation(data: OnboardingData): string {
  const name = firstName(data);
  const active = activeConditions(data);
  if (data.goal === 'muscle_gain') {
    return `Increase your protein toward ${proteinTarget(data)}g today, ${name}, to push your ${goalLabel(data.goal).toLowerCase()} goal.`;
  }
  if (data.goal === 'weight_loss') {
    return `Swap one snack for vegetables to stay under ${calorieTarget(data)} kcal and keep your weight loss on track, ${name}.`;
  }
  if (active.length > 0) {
    return `Add more leafy greens today, ${name} — a simple win that supports both your goal and your health profile.`;
  }
  return `Add a serving of leafy greens today, ${name}, to round out your nutrition and energy.`;
}
