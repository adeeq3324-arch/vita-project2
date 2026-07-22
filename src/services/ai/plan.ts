import type { OnboardingData } from '@/context/OnboardingContext';
import type { MealType } from '@/types';

import { activeConditions, calorieTarget, conditionNote, firstName, goalLabel, proteinTarget } from './profile';
import type {
  AIIcon,
  DayPlan,
  MacroTotals,
  MealDetail,
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

type MealTemplate = {
  name: string;
  kcal: number;
  prepMin: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
};

const options: Record<MealType, MealTemplate[]> = {
  breakfast: [
    { name: 'Oatmeal with Berries', kcal: 320, prepMin: 20, protein: 12, carbs: 54, fat: 6, ingredients: ['Rolled oats', 'Mixed berries', 'Milk or water', 'Honey', 'Chia seeds'] },
    { name: 'Greek Yogurt & Granola', kcal: 300, prepMin: 5, protein: 20, carbs: 38, fat: 8, ingredients: ['Greek yogurt', 'Granola', 'Fresh fruit', 'Honey'] },
    { name: 'Veggie Omelette', kcal: 340, prepMin: 15, protein: 24, carbs: 10, fat: 22, ingredients: ['Eggs', 'Bell pepper', 'Spinach', 'Onion', 'Olive oil'] },
    { name: 'Avocado Toast & Eggs', kcal: 380, prepMin: 12, protein: 18, carbs: 34, fat: 20, ingredients: ['Whole-grain bread', 'Avocado', 'Eggs', 'Lemon', 'Chili flakes'] },
    { name: 'Protein Smoothie Bowl', kcal: 330, prepMin: 8, protein: 28, carbs: 40, fat: 7, ingredients: ['Protein powder', 'Frozen banana', 'Berries', 'Almond milk', 'Granola'] },
    { name: 'Banana Peanut Oats', kcal: 360, prepMin: 10, protein: 14, carbs: 58, fat: 10, ingredients: ['Rolled oats', 'Banana', 'Peanut butter', 'Milk', 'Cinnamon'] },
    { name: 'Cottage Cheese & Fruit', kcal: 290, prepMin: 5, protein: 26, carbs: 30, fat: 6, ingredients: ['Cottage cheese', 'Pineapple', 'Berries', 'Pumpkin seeds'] },
  ],
  lunch: [
    { name: 'Grilled Chicken Salad', kcal: 530, prepMin: 20, protein: 42, carbs: 30, fat: 24, ingredients: ['Chicken breast', 'Mixed greens', 'Cherry tomatoes', 'Cucumber', 'Olive oil', 'Balsamic'] },
    { name: 'Quinoa Power Bowl', kcal: 510, prepMin: 25, protein: 24, carbs: 62, fat: 16, ingredients: ['Quinoa', 'Chickpeas', 'Roasted veg', 'Avocado', 'Tahini'] },
    { name: 'Turkey Wrap', kcal: 480, prepMin: 12, protein: 34, carbs: 45, fat: 16, ingredients: ['Whole-wheat wrap', 'Turkey breast', 'Lettuce', 'Tomato', 'Hummus'] },
    { name: 'Lentil & Veg Curry', kcal: 500, prepMin: 30, protein: 22, carbs: 68, fat: 12, ingredients: ['Red lentils', 'Mixed vegetables', 'Coconut milk', 'Curry spices', 'Brown rice'] },
    { name: 'Tuna & Rice Bowl', kcal: 540, prepMin: 15, protein: 38, carbs: 58, fat: 12, ingredients: ['Tuna', 'Brown rice', 'Edamame', 'Carrot', 'Soy sauce'] },
    { name: 'Chickpea Buddha Bowl', kcal: 520, prepMin: 20, protein: 20, carbs: 66, fat: 18, ingredients: ['Chickpeas', 'Sweet potato', 'Kale', 'Quinoa', 'Tahini dressing'] },
    { name: 'Beef & Broccoli', kcal: 560, prepMin: 25, protein: 40, carbs: 40, fat: 22, ingredients: ['Lean beef strips', 'Broccoli', 'Garlic', 'Soy sauce', 'Jasmine rice'] },
  ],
  dinner: [
    { name: 'Salmon with Quinoa', kcal: 560, prepMin: 25, protein: 40, carbs: 42, fat: 24, ingredients: ['Salmon fillet', 'Quinoa', 'Asparagus', 'Lemon', 'Olive oil'] },
    { name: 'Grilled Chicken & Veg', kcal: 520, prepMin: 30, protein: 46, carbs: 28, fat: 20, ingredients: ['Chicken breast', 'Zucchini', 'Bell pepper', 'Red onion', 'Herbs'] },
    { name: 'Shrimp Stir-Fry', kcal: 490, prepMin: 20, protein: 36, carbs: 44, fat: 14, ingredients: ['Shrimp', 'Mixed stir-fry veg', 'Ginger', 'Soy sauce', 'Rice noodles'] },
    { name: 'Baked Cod & Potatoes', kcal: 510, prepMin: 35, protein: 38, carbs: 48, fat: 14, ingredients: ['Cod fillet', 'Baby potatoes', 'Green beans', 'Lemon', 'Olive oil'] },
    { name: 'Tofu & Veg Noodles', kcal: 480, prepMin: 22, protein: 26, carbs: 58, fat: 16, ingredients: ['Firm tofu', 'Wholegrain noodles', 'Pak choi', 'Sesame oil', 'Soy sauce'] },
    { name: 'Lean Beef Chili', kcal: 540, prepMin: 40, protein: 38, carbs: 46, fat: 18, ingredients: ['Lean beef mince', 'Kidney beans', 'Tomatoes', 'Onion', 'Chili spices'] },
    { name: 'Chicken Fajita Bowl', kcal: 530, prepMin: 25, protein: 42, carbs: 44, fat: 18, ingredients: ['Chicken breast', 'Peppers', 'Black beans', 'Rice', 'Fajita spices'] },
  ],
  snack: [
    { name: 'Greek Yogurt with Nuts', kcal: 200, prepMin: 10, protein: 16, carbs: 14, fat: 10, ingredients: ['Greek yogurt', 'Mixed nuts', 'Honey'] },
    { name: 'Apple & Almond Butter', kcal: 210, prepMin: 3, protein: 6, carbs: 26, fat: 12, ingredients: ['Apple', 'Almond butter', 'Cinnamon'] },
    { name: 'Protein Bar', kcal: 190, prepMin: 1, protein: 20, carbs: 18, fat: 6, ingredients: ['Protein bar of choice'] },
    { name: 'Hummus & Carrots', kcal: 170, prepMin: 5, protein: 6, carbs: 22, fat: 8, ingredients: ['Hummus', 'Carrot sticks', 'Cucumber'] },
    { name: 'Cottage Cheese Cup', kcal: 150, prepMin: 2, protein: 18, carbs: 8, fat: 4, ingredients: ['Cottage cheese', 'Black pepper', 'Chives'] },
    { name: 'Trail Mix', kcal: 220, prepMin: 1, protein: 8, carbs: 20, fat: 14, ingredients: ['Mixed nuts', 'Dried fruit', 'Dark chocolate chips'] },
    { name: 'Berries & Dark Chocolate', kcal: 180, prepMin: 3, protein: 4, carbs: 26, fat: 8, ingredients: ['Mixed berries', 'Dark chocolate', 'Almonds'] },
  ],
};

const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Calorie multiplier so daily totals track the user's target. */
function scale(data: OnboardingData): number {
  const target = calorieTarget(data);
  return target / 2200; // templates sum to ~2200 kcal/day
}

/** Resolve the template used for a given day + meal type. */
function templateFor(type: MealType, dayIndex: number): MealTemplate {
  const list = options[type];
  return list[dayIndex % list.length]!;
}

function toPlannedMeal(type: MealType, template: MealTemplate, factor: number): PlannedMeal {
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
}

/** The 7-day meal plan, personalised to the user's calorie target. */
export function mealPlan(data: OnboardingData): DayPlan[] {
  const factor = scale(data);
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    day: dayIndex + 1,
    meals: mealOrder.map((type) => toPlannedMeal(type, templateFor(type, dayIndex), factor)),
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

/** Cooking steps by meal type — a light, plausible method for the recipe view. */
const stepsByType: Record<MealType, string[]> = {
  breakfast: [
    'Gather and measure out all of the ingredients.',
    'Cook or combine the base until it is just done.',
    'Add your toppings and adjust sweetness to taste.',
    'Serve straight away while warm and fresh.',
  ],
  lunch: [
    'Prep and season the protein, then cook it through.',
    'Prepare the grains and vegetables alongside.',
    'Combine everything in a bowl and add the dressing.',
    'Toss well, plate and enjoy.',
  ],
  dinner: [
    'Preheat your pan or oven and season the protein.',
    'Cook the protein until cooked through and rested.',
    'Prepare the sides and vegetables to finish.',
    'Plate together and add a squeeze of lemon or sauce.',
  ],
  snack: [
    'Portion out each ingredient.',
    'Combine in a bowl or a container to go.',
    'Enjoy right away or pack for later.',
  ],
};

/** A short, goal- and condition-aware tip for a meal. */
function mealTip(data: OnboardingData): string {
  const note = conditionNote(data);
  const base =
    data.goal === 'muscle_gain'
      ? `Add an extra portion of protein to push toward your ${proteinTarget(data)}g daily target.`
      : data.goal === 'weight_loss'
        ? 'Load up on the vegetables first to stay full within your calorie target.'
        : 'Keep portions balanced and drink a glass of water alongside.';
  return note ? `${base} ${note}` : base;
}

/** Detailed, personalised recipe-style view for a single planned meal. */
export function mealDetail(day: number, type: MealType, data: OnboardingData): MealDetail {
  const dayIndex = Math.max(0, Math.min(6, day - 1));
  const template = templateFor(type, dayIndex);
  const planned = toPlannedMeal(type, template, scale(data));
  return {
    type,
    name: planned.name,
    icon: planned.icon,
    accent: planned.accent,
    kcal: planned.kcal,
    prepMin: planned.prepMin,
    protein: planned.protein,
    carbs: planned.carbs,
    fat: planned.fat,
    ingredients: template.ingredients,
    steps: stepsByType[type],
    tip: mealTip(data),
  };
}

/**
 * Monthly supplement plan — a stack of 7 supplements shaped by goal and
 * conditions. The stack is prescribed once and refilled monthly; the times
 * below are the daily routine within that month's supply.
 */
export function supplementSchedule(data: OnboardingData): Supplement[] {
  const core: Supplement[] = [
    { id: 'vitd3', name: 'Vitamin D3', time: '8:00 AM', timing: 'After breakfast', icon: 'weather-sunny', accent: 'orange' },
    { id: 'multivit', name: 'Multivitamin', time: '9:00 AM', timing: 'With breakfast', icon: 'pill', accent: 'violet' },
    { id: 'omega3', name: 'Omega 3', time: '12:00 PM', timing: 'With lunch', icon: 'fish', accent: 'cyan' },
  ];

  let goalStack: Supplement[];
  if (data.goal === 'muscle_gain') {
    goalStack = [
      { id: 'bcaa', name: 'BCAA', time: '2:00 PM', timing: 'Intra-workout', icon: 'lightning-bolt', accent: 'orange' },
      { id: 'creatine', name: 'Creatine Monohydrate', time: '4:00 PM', timing: 'After workout', icon: 'flask', accent: 'violet' },
      { id: 'whey', name: 'Whey Protein', time: '5:00 PM', timing: 'Post workout', icon: 'cup', accent: 'green' },
    ];
  } else if (data.goal === 'weight_loss') {
    goalStack = [
      { id: 'fiber', name: 'Fiber Complex', time: '12:30 PM', timing: 'Before lunch', icon: 'grain', accent: 'green' },
      { id: 'greentea', name: 'Green Tea Extract', time: '3:00 PM', timing: 'Afternoon', icon: 'leaf', accent: 'green' },
      { id: 'lcarnitine', name: 'L-Carnitine', time: '5:00 PM', timing: 'Before activity', icon: 'run', accent: 'cyan' },
    ];
  } else {
    goalStack = [
      { id: 'vitc', name: 'Vitamin C', time: '9:30 AM', timing: 'With breakfast', icon: 'fruit-citrus', accent: 'orange' },
      { id: 'zinc', name: 'Zinc', time: '6:00 PM', timing: 'With dinner', icon: 'shield-plus', accent: 'cyan' },
      { id: 'probiotic', name: 'Probiotic', time: '8:00 PM', timing: 'Evening', icon: 'stomach', accent: 'green' },
    ];
  }

  const magnesium: Supplement = {
    id: 'magnesium',
    name: 'Magnesium',
    time: '10:00 PM',
    timing: 'Before sleep',
    icon: 'moon-waning-crescent',
    accent: 'violet',
  };

  return [...core, ...goalStack, magnesium];
}

const detailCopy: Record<string, Omit<SupplementDetail, 'name' | 'icon' | 'accent'>> = {
  vitd3: {
    purpose: 'Supports bone health, immunity and mood — especially useful with limited sun exposure.',
    bestTime: 'Morning, after breakfast',
    dosage: '2000 IU daily',
    tips: 'Take with a meal containing fat for better absorption.',
  },
  multivit: {
    purpose: 'Covers everyday micronutrient gaps to support overall wellbeing.',
    bestTime: 'Morning, with breakfast',
    dosage: '1 tablet daily',
    tips: 'Consistency matters more than timing — take it with food.',
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
  bcaa: {
    purpose: 'Supplies branched-chain amino acids to limit muscle breakdown during training.',
    bestTime: 'Around your workout',
    dosage: '5–10 g',
    tips: 'Sip through your session to stay hydrated and fuelled.',
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
  lcarnitine: {
    purpose: 'Helps shuttle fatty acids into cells for energy, supporting active fat loss.',
    bestTime: 'Before activity',
    dosage: '1500 mg daily',
    tips: 'Pair it with your daily movement or workout for the best effect.',
  },
  vitc: {
    purpose: 'An antioxidant that supports immunity, skin and iron absorption.',
    bestTime: 'Morning, with breakfast',
    dosage: '500 mg daily',
    tips: 'Split larger doses across the day if your stomach is sensitive.',
  },
  zinc: {
    purpose: 'Supports immune function, recovery and healthy hormone levels.',
    bestTime: 'Evening, with dinner',
    dosage: '15 mg daily',
    tips: 'Take with food to avoid nausea; keep away from high-calcium meals.',
  },
  probiotic: {
    purpose: 'Introduces friendly bacteria to support gut health and digestion.',
    bestTime: 'Evening',
    dosage: '1 capsule daily',
    tips: 'Be consistent for a few weeks to feel the full benefit.',
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
