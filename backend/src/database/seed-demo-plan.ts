import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { startOfMonth, startOfWeek, todayIn } from '../common/util/date.util';
import { withDisclaimer } from '../supplement-plans/supplement-plan.schema';
import * as schema from './schema';
import {
  mealPlanItems,
  mealPlans,
  mealRecipes,
  nutritionTargets,
  profiles,
  supplementPlanItems,
  supplementPlans,
  users,
  type NewMealPlanItem,
  type NewMealRecipe,
  type NewSupplementPlanItem,
  type RecipeIngredient,
  type RecipeStep,
  type SupplementIngredient,
} from './schema';

/**
 * Development-only demo plan seeder.
 *
 * The planning screens read a generated plan through the API; until the AI
 * provider is configured there is nothing for them to read, and the design
 * cannot be reviewed. This writes one week of meals, recipes for the first day's
 * dishes, and one month of supplements straight into the tables the generator
 * would have written to, in `ready` status, so the real screens render real rows
 * over the real endpoints — the only thing skipped is the model call.
 *
 * It is not a fixture for tests and not part of any release step. Delete the
 * rows (or simply tap "Generate") once a provider is configured: a genuine
 * generation replaces this plan in place.
 *
 *   npm run db:seed:plan -- you@example.com
 *
 * `brand`, `rating` and `rating_count` are written here even though the
 * generator never writes them. They exist so the product strip on the
 * supplement detail screen can be reviewed against the design; a real plan
 * leaves them null and the screen omits the strip entirely.
 */

/** A meal as the seeder describes it, before it becomes a row. */
interface DemoMeal {
  readonly mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  readonly name: string;
  /** calories, protein, carbs, fat, fibre — the five figures the detail screen shows. */
  readonly macros: readonly [number, number, number, number, number];
  readonly reasoning: string;
}

/**
 * When each sitting is eaten in the seeded week.
 *
 * A flat table rather than a per-meal field: the generator varies these by
 * person, but the demo plan only needs a plausible day so the timeline on the
 * plan screen can be laid out and reviewed.
 */
const DEMO_TIMES: Record<DemoMeal['mealType'], string> = {
  breakfast: '07:30',
  lunch: '12:30',
  dinner: '19:00',
  snack: '16:00',
};

/**
 * Seven days of meals.
 *
 * Monday's breakfast carries the exact figures from the design (412 kcal,
 * 24 g protein, 46 g carbs, 12 g fat, 7 g fibre) so the stat row and the
 * nutrition donut can be checked against the mockup number for number.
 */
const WEEK: readonly (readonly DemoMeal[])[] = [
  [
    {
      mealType: 'breakfast',
      name: 'Greek Yogurt Berry Bowl',
      macros: [412, 24, 46, 12, 7],
      reasoning:
        'High-protein dairy first thing keeps you full through the morning, and the berries add fibre without pushing the calories up. It sets the day up to hit your protein target early.',
    },
    {
      mealType: 'lunch',
      name: 'Grilled Chicken Quinoa Bowl',
      macros: [560, 42, 55, 16, 9],
      reasoning:
        'Lean protein with a slow-releasing grain gives you steady energy into the afternoon rather than the dip a lighter lunch would leave you with.',
    },
    {
      mealType: 'dinner',
      name: 'Baked Salmon with Sweet Potato',
      macros: [620, 41, 48, 27, 8],
      reasoning:
        'Oily fish covers your omega-3 intake for the day and the sweet potato replaces the carbohydrate you used training, which is what makes recovery overnight possible.',
    },
    {
      mealType: 'snack',
      name: 'Apple with Almond Butter',
      macros: [230, 6, 25, 13, 5],
      reasoning:
        'A small, portable snack that pairs fibre with fat, so it holds you between meals instead of spiking and dropping the way fruit alone would.',
    },
  ],
  [
    {
      mealType: 'breakfast',
      name: 'Spinach and Feta Omelette',
      macros: [380, 26, 12, 25, 3],
      reasoning:
        'A low-carbohydrate start on a lighter training day, with enough protein to protect muscle while the total for the day stays under your target.',
    },
    {
      mealType: 'lunch',
      name: 'Turkey and Avocado Wrap',
      macros: [540, 38, 46, 22, 8],
      reasoning:
        'Quick to assemble and easy to eat away from home, which matters more than perfection on a weekday — the macros still land where they need to.',
    },
    {
      mealType: 'dinner',
      name: 'Beef Stir-Fry with Brown Rice',
      macros: [650, 44, 62, 22, 7],
      reasoning:
        'Red meat covers iron and zinc, both of which support training adaptation, and the rice restores glycogen ahead of tomorrow.',
    },
    {
      mealType: 'snack',
      name: 'Cottage Cheese with Pineapple',
      macros: [210, 22, 18, 4, 1],
      reasoning:
        'Slow-digesting casein protein in a small package, useful late in the day when you need protein without much else alongside it.',
    },
  ],
  [
    {
      mealType: 'breakfast',
      name: 'Overnight Oats with Chia',
      macros: [430, 18, 58, 14, 11],
      reasoning:
        'Prepared the night before, so a rushed morning cannot turn into a skipped meal. The chia pushes the fibre well past a third of your daily need.',
    },
    {
      mealType: 'lunch',
      name: 'Lentil and Vegetable Soup',
      macros: [480, 26, 62, 12, 15],
      reasoning:
        'Plant protein and a large fibre contribution in one bowl, which balances the animal protein the rest of the week leans on.',
    },
    {
      mealType: 'dinner',
      name: 'Grilled Chicken with Roasted Vegetables',
      macros: [590, 46, 40, 24, 9],
      reasoning:
        'The highest-protein meal of the day placed in the evening, when the gap until breakfast is longest and muscle repair is happening.',
    },
    {
      mealType: 'snack',
      name: 'Mixed Nuts and Dried Apricots',
      macros: [240, 7, 20, 15, 4],
      reasoning:
        'Energy-dense enough to matter on a heavy day, but portioned so it adds to the plan rather than quietly replacing a meal.',
    },
  ],
  [
    {
      mealType: 'breakfast',
      name: 'Scrambled Eggs on Rye Toast',
      macros: [400, 25, 34, 17, 6],
      reasoning:
        'Whole eggs give you a complete protein and the rye keeps the carbohydrate slow, so hunger does not arrive an hour later.',
    },
    {
      mealType: 'lunch',
      name: 'Tuna Nicoise Salad',
      macros: [520, 40, 30, 26, 7],
      reasoning:
        'Light on carbohydrate at midday to leave room for the larger evening meal, without giving up any protein.',
    },
    {
      mealType: 'dinner',
      name: 'Chickpea and Spinach Curry',
      macros: [600, 24, 78, 20, 16],
      reasoning:
        'A meat-free evening keeps the week varied, and the legumes carry both protein and the largest single fibre contribution in the plan.',
    },
    {
      mealType: 'snack',
      name: 'Protein Smoothie with Banana',
      macros: [250, 25, 28, 4, 3],
      reasoning:
        'Fast-absorbing protein and simple carbohydrate, best taken close to training when digestion needs to be easy.',
    },
  ],
  [
    {
      mealType: 'breakfast',
      name: 'Banana Peanut Butter Toast',
      macros: [420, 15, 55, 16, 7],
      reasoning:
        'Carbohydrate-forward before a training day, timed so the energy is available when you need it rather than stored.',
    },
    {
      mealType: 'lunch',
      name: 'Chicken Caesar Wrap',
      macros: [550, 39, 45, 23, 5],
      reasoning:
        'A familiar meal kept within your targets — a plan you actually want to eat is a plan you will still be following in three weeks.',
    },
    {
      mealType: 'dinner',
      name: 'Grilled Prawns with Couscous',
      macros: [570, 38, 60, 16, 6],
      reasoning:
        'Very lean protein with a light grain, so the meal sits comfortably in the evening while still refilling what training used.',
    },
    {
      mealType: 'snack',
      name: 'Greek Yogurt with Honey',
      macros: [200, 18, 22, 4, 0],
      reasoning:
        'A small protein top-up that closes the gap between your daily total and your target without adding a fourth full meal.',
    },
  ],
  [
    {
      mealType: 'breakfast',
      name: 'Vegetable Shakshuka',
      macros: [390, 22, 26, 22, 8],
      reasoning:
        'A slower weekend breakfast that still earns its place: eggs for protein, tomatoes and peppers for the micronutrients weekdays tend to miss.',
    },
    {
      mealType: 'lunch',
      name: 'Beef and Barley Bowl',
      macros: [580, 40, 58, 18, 10],
      reasoning:
        'Barley digests slowly, which keeps the afternoon steady, and the beef keeps protein on pace with the rest of the week.',
    },
    {
      mealType: 'dinner',
      name: 'Roast Chicken with Potatoes',
      macros: [640, 48, 52, 24, 7],
      reasoning:
        'The largest meal of the week, placed on the day you are most likely to eat with other people. Nothing about it needs to be eaten alone.',
    },
    {
      mealType: 'snack',
      name: 'Dark Chocolate and Almonds',
      macros: [220, 6, 18, 15, 5],
      reasoning:
        'A deliberate treat inside the plan rather than outside it, which is what stops a good week ending in an unplanned one.',
    },
  ],
  [
    {
      mealType: 'breakfast',
      name: 'Protein Pancakes with Berries',
      macros: [440, 30, 50, 12, 6],
      reasoning:
        'Thirty grams of protein in a breakfast that does not read like a diet, so the last day of the week is as easy to follow as the first.',
    },
    {
      mealType: 'lunch',
      name: 'Falafel and Hummus Plate',
      macros: [560, 22, 64, 24, 14],
      reasoning:
        'Legume-based and high in fibre, which supports digestion after a week weighted towards animal protein.',
    },
    {
      mealType: 'dinner',
      name: 'Baked Cod with Green Beans',
      macros: [520, 44, 38, 20, 9],
      reasoning:
        'A lighter close to the week: high protein, low energy density, and easy to sleep on before the next week starts.',
    },
    {
      mealType: 'snack',
      name: 'Rice Cakes with Cottage Cheese',
      macros: [190, 16, 24, 3, 2],
      reasoning:
        'The smallest snack in the plan, there to keep protein even across the day rather than to add energy.',
    },
  ],
];

/** A recipe as the seeder describes it, before it becomes a row. */
interface DemoRecipe {
  readonly summary: string;
  readonly cuisine: string;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly servings: number;
  readonly prepMinutes: number;
  readonly cookMinutes: number;
  readonly ingredients: readonly RecipeIngredient[];
  readonly steps: readonly RecipeStep[];
  readonly tips: readonly string[];
}

/**
 * Recipes for the first day's four dishes, keyed by the dish they belong to.
 *
 * Only Monday, and deliberately so. A recipe is generated on demand rather than
 * with the plan, so the seeder's job here is not to fill the week — it is to
 * make sure the recipe screen has something real to render before an AI provider
 * exists, and one full day of dishes covers every state the screen has: a
 * no-cook snack, a long ingredient list, a method with timed steps.
 *
 * Every other dish in the week deliberately has none. Opening one of those is
 * how the generate-on-first-open path gets exercised once a provider is
 * configured, and seeding all twenty-eight would hide that behaviour behind
 * fixtures.
 */
const RECIPES: Readonly<Record<string, DemoRecipe>> = {
  'Greek Yogurt Berry Bowl': {
    summary:
      'A cold, five-minute breakfast built on thick Greek yogurt, with oats and chia for staying power and berries for sweetness that costs almost nothing in calories. Assembled in the bowl you eat it from.',
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    servings: 1,
    prepMinutes: 8,
    cookMinutes: 0,
    ingredients: [
      { name: 'Greek yogurt, 0% fat', quantity: '180 g' },
      { name: 'Mixed berries', quantity: '120 g', note: 'fresh or frozen and thawed' },
      { name: 'Rolled oats', quantity: '25 g' },
      { name: 'Chia seeds', quantity: '1 tbsp' },
      { name: 'Flaked almonds', quantity: '10 g' },
      { name: 'Honey', quantity: '1 tsp' },
    ],
    steps: [
      {
        title: 'Soak the oats',
        instruction:
          'Stir the oats and chia seeds through the yogurt and leave the bowl to stand for five minutes. The oats soften and the chia thickens the yogurt, which is what turns this from a snack into a breakfast that holds until lunch.',
        minutes: 5,
      },
      {
        title: 'Toast the almonds',
        instruction:
          'Warm a dry pan over a medium heat and toast the flaked almonds for a minute or two, moving them constantly, until they smell nutty and colour at the edges. Tip them straight out of the pan — they will keep browning in it.',
        minutes: 2,
      },
      {
        title: 'Build the bowl',
        instruction:
          'Spoon the yogurt into a bowl, pile the berries over one half, and scatter the almonds across the top. Crushing a few of the berries against the side of the bowl first bleeds colour through the yogurt.',
        minutes: 1,
      },
      {
        title: 'Finish',
        instruction:
          'Drizzle the honey over the berries rather than the yogurt, so the sweetness lands where you taste it and one teaspoon does the work of two.',
        minutes: 0,
      },
    ],
    tips: [
      'Frozen berries are cheaper and work better here — thaw them in the bowl and the juice ripples through the yogurt.',
      'Assemble it in a jar the night before and it keeps for two days in the fridge; add the almonds only as you eat it, or they soften.',
      'Swap the honey for a mashed half banana if you would rather keep the added sugar out.',
    ],
  },
  'Grilled Chicken Quinoa Bowl': {
    summary:
      'Charred chicken breast over lemony quinoa with a raw, crunchy salad through it. The quinoa cooks unattended while everything else happens, so the whole bowl lands in about half an hour.',
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    servings: 1,
    prepMinutes: 12,
    cookMinutes: 20,
    ingredients: [
      { name: 'Chicken breast', quantity: '150 g' },
      { name: 'Quinoa', quantity: '60 g', note: 'dry weight' },
      { name: 'Cherry tomatoes', quantity: '100 g', note: 'halved' },
      { name: 'Cucumber', quantity: '80 g', note: 'diced' },
      { name: 'Red onion', quantity: '25 g', note: 'finely sliced' },
      { name: 'Olive oil', quantity: '1 tbsp' },
      { name: 'Lemon', quantity: '½' },
      { name: 'Smoked paprika', quantity: '1 tsp' },
      { name: 'Salt and black pepper', quantity: 'a pinch of each' },
    ],
    steps: [
      {
        title: 'Cook the quinoa',
        instruction:
          'Rinse the quinoa under cold water until it runs clear — this washes off the bitter coating. Simmer it in twice its volume of water, covered, for fifteen minutes, then take it off the heat and leave it to sit for five with the lid on.',
        minutes: 20,
      },
      {
        title: 'Season the chicken',
        instruction:
          'Flatten the breast to an even thickness with the heel of your hand so it cooks through at the same rate, then rub it with half the olive oil, the paprika, salt and pepper.',
        minutes: 4,
      },
      {
        title: 'Grill it',
        instruction:
          'Get a griddle pan properly hot before the chicken goes anywhere near it. Cook for five to six minutes a side without moving it, until the bars have marked it and the juices run clear. Rest it for three minutes before slicing.',
        minutes: 15,
      },
      {
        title: 'Dress the salad',
        instruction:
          'Toss the tomatoes, cucumber and onion with the remaining oil and a good squeeze of lemon. Salt them now, not earlier — salted tomatoes sitting around go watery.',
        minutes: 3,
      },
      {
        title: 'Assemble',
        instruction:
          'Fork the quinoa through to separate the grains, squeeze the rest of the lemon over it, then top with the salad and the sliced chicken. Spoon any juices from the resting board over the lot.',
        minutes: 2,
      },
    ],
    tips: [
      'Cook the quinoa in stock instead of water — it is the single biggest improvement you can make to this bowl for no extra effort.',
      'Chicken thigh works just as well and is harder to overcook; add four minutes to the grilling time.',
      'The salad and quinoa keep for three days in the fridge, so double them and only the chicken needs cooking tomorrow.',
    ],
  },
  'Baked Salmon with Sweet Potato': {
    summary:
      'A one-tray dinner: sweet potato wedges roasted until their edges caramelise, with a salmon fillet laid on top for the last stretch so it steams in its own lemon and dill. Almost nothing to wash up.',
    cuisine: 'Nordic',
    difficulty: 'easy',
    servings: 1,
    prepMinutes: 10,
    cookMinutes: 32,
    ingredients: [
      { name: 'Salmon fillet', quantity: '160 g', note: 'skin on' },
      { name: 'Sweet potato', quantity: '250 g', note: 'cut into wedges' },
      { name: 'Tenderstem broccoli', quantity: '100 g' },
      { name: 'Olive oil', quantity: '1 tbsp' },
      { name: 'Garlic', quantity: '1 clove', note: 'crushed' },
      { name: 'Lemon', quantity: '½', note: 'sliced' },
      { name: 'Fresh dill', quantity: '1 tbsp', note: 'chopped' },
      { name: 'Salt and black pepper', quantity: 'a pinch of each' },
    ],
    steps: [
      {
        title: 'Heat the oven',
        instruction:
          'Set the oven to 200 °C fan and put the empty tray in while it comes up to temperature. Wedges hitting hot metal start crisping immediately instead of sweating.',
        minutes: 8,
      },
      {
        title: 'Roast the sweet potato',
        instruction:
          'Toss the wedges with half the oil, the garlic, salt and pepper, spread them on the hot tray in a single layer with space between them, and roast for twenty minutes. Turn them once halfway.',
        minutes: 20,
      },
      {
        title: 'Add the salmon',
        instruction:
          'Push the wedges to one side, lay the salmon skin-side down on the tray with the lemon slices over it, and add the broccoli tossed in the rest of the oil. Back in the oven for twelve minutes.',
        minutes: 12,
      },
      {
        title: 'Check it',
        instruction:
          'The salmon is done when the flesh has turned opaque and separates into flakes under gentle pressure from a fork. Another two minutes will dry it out, so check early rather than late.',
        minutes: 1,
      },
      {
        title: 'Finish and serve',
        instruction:
          'Scatter the dill over everything and squeeze one of the roasted lemon slices across the fish. Roasted lemon is sweeter and less sharp than raw, which is why it goes in the oven rather than on the plate.',
        minutes: 1,
      },
    ],
    tips: [
      'Leave the skin on while it cooks even if you do not eat it — it holds the fillet together and keeps the underside from drying.',
      'Cold salmon straight from the fridge cooks unevenly; give it ten minutes on the counter while the oven heats.',
      'Leftover wedges reheat far better in a dry pan than a microwave, which turns them soft.',
    ],
  },
  'Apple with Almond Butter': {
    summary:
      'The plan’s simplest thing to make: a sliced apple and a spoon of almond butter, with cinnamon and a pinch of salt doing more than either has any right to. Two minutes, no cooking, entirely portable.',
    cuisine: 'American',
    difficulty: 'easy',
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 0,
    ingredients: [
      { name: 'Apple', quantity: '1 medium', note: 'about 180 g' },
      { name: 'Almond butter', quantity: '20 g', note: 'unsweetened' },
      { name: 'Ground cinnamon', quantity: 'a pinch' },
      { name: 'Sea salt', quantity: 'a small pinch' },
      { name: 'Lemon juice', quantity: '1 tsp' },
    ],
    steps: [
      {
        title: 'Slice the apple',
        instruction:
          'Quarter the apple, cut out the core, and slice each quarter into three or four wedges. Wedges hold almond butter far better than rounds do.',
        minutes: 3,
      },
      {
        title: 'Stop it browning',
        instruction:
          'Toss the slices with the lemon juice if this is going in a bag for later. Eaten now it makes no difference; left two hours it is the difference between an appetising snack and a brown one.',
        minutes: 1,
      },
      {
        title: 'Finish',
        instruction:
          'Spoon the almond butter into a small pot to dip, or spread it straight onto the slices, then dust with cinnamon and the smallest pinch of salt. The salt is what makes the almond butter taste of almonds.',
        minutes: 1,
      },
    ],
    tips: [
      'Buy almond butter whose only ingredient is almonds — the sweetened kind turns this from a balanced snack into a dessert.',
      'A firm, tart apple stands up to the almond butter; a soft sweet one disappears under it.',
      'Pack the almond butter in a separate pot rather than pre-spread, and the slices stay crisp until you eat them.',
    ],
  },
};

/** A supplement as the seeder describes it, before it becomes a row. */
interface DemoSupplement {
  readonly supplementName: string;
  readonly tier: 'core' | 'optional';
  readonly bestTime:
    | 'morning'
    | 'afternoon'
    | 'evening'
    | 'withMeal'
    | 'preWorkout'
    | 'postWorkout'
    | 'beforeBed';
  readonly category: string;
  readonly headline: string;
  readonly purpose: string;
  readonly servingSize: string;
  /** The facts panel — what a standard product of this type contains. */
  readonly ingredients: readonly SupplementIngredient[];
  readonly benefits: readonly string[];
  readonly safety: readonly string[];
  /**
   * The closing advice. Written here without the standing disclaimer: it is
   * appended by {@link withDisclaimer} on the way in, exactly as it is for a
   * generated plan, so the seeded rows carry the same guarantee.
   */
  readonly recommendation: string;
  readonly brand?: string;
  readonly rating?: number;
  readonly ratingCount?: number;
}

const SUPPLEMENTS: readonly DemoSupplement[] = [
  {
    supplementName: 'Whey Protein Isolate',
    tier: 'core',
    bestTime: 'postWorkout',
    category: 'Protein supplement',
    headline: 'Muscle recovery and growth',
    purpose:
      'Closes the gap between the protein your meals provide and the amount your training actually calls for.',
    servingSize: '1 scoop (30 g)',
    ingredients: [
      { name: 'Energy', amount: '113 kcal' },
      { name: 'Protein', amount: '25 g' },
      { name: 'Carbohydrate', amount: '1.5 g' },
      { name: 'Fat', amount: '0.4 g' },
      { name: 'Leucine', amount: '2.7 g' },
      { name: 'Sodium', amount: '55 mg' },
    ],
    recommendation:
      'Protein powder is food rather than medicine, but how much of it suits you depends on what your meals already provide and on how well your kidneys are working. Ask a doctor or a registered dietitian to look at your whole intake before you add it.',
    benefits: [
      'Supplies all nine essential amino acids in one serving',
      'Absorbed quickly, which suits the window straight after training',
      'Makes a daily protein target realistic without a fourth meal',
    ],
    safety: [
      'Contains milk. Not suitable if you have a dairy allergy.',
      'Lactose-sensitive users should choose an isolate over a concentrate.',
      'Not a replacement for protein from whole foods.',
    ],
    brand: 'PureFuel',
    rating: 4.8,
    ratingCount: 230,
  },
  {
    supplementName: 'Creatine Monohydrate',
    tier: 'core',
    bestTime: 'postWorkout',
    category: 'Performance supplement',
    headline: 'Strength and power output',
    purpose:
      'The most studied performance supplement there is, and the one most likely to change what you can lift.',
    servingSize: '1 level teaspoon (5 g)',
    ingredients: [
      { name: 'Creatine monohydrate', amount: '5 g' },
      { name: 'Energy', amount: '0 kcal' },
    ],
    recommendation:
      'Creatine is well tolerated by most people, but it is processed by the kidneys and the right amount depends on your body mass and your training. Speak to a doctor before starting, and mention it specifically if you have ever had a kidney problem or take medication that affects them.',
    benefits: [
      'Increases available energy for short, hard efforts',
      'Supports strength gains across a training block',
      'Well evidenced in decades of published research',
    ],
    safety: [
      'Drink more water than usual while taking it.',
      'A small early weight gain is water inside the muscle, not fat.',
      'Speak to a doctor first if you have any kidney condition.',
    ],
  },
  {
    supplementName: 'Vitamin D3',
    tier: 'core',
    bestTime: 'withMeal',
    category: 'Vitamin',
    headline: 'Bone health and immune support',
    purpose:
      'Sunlight alone rarely covers this at your latitude, and a shortfall shows up as fatigue long before anything else.',
    servingSize: '1 softgel',
    ingredients: [
      { name: 'Vitamin D3 (cholecalciferol)', amount: '1000 IU (25 µg)' },
      { name: 'Extra virgin olive oil', amount: '250 mg' },
    ],
    recommendation:
      'This is the one worth measuring rather than guessing: a simple blood test shows whether you are short and by how much, and that is what decides the right amount. Ask your doctor for that test before you start, and tell them about any heart or blood-pressure medication you take.',
    benefits: [
      'Supports calcium absorption and bone density',
      'Contributes to normal immune function',
      'Corrects a shortfall that is common through winter',
    ],
    safety: [
      'Fat-soluble, so it accumulates — do not exceed the label dose.',
      'Can interact with some heart and diuretic medication.',
    ],
  },
  {
    supplementName: 'Omega-3 Fish Oil',
    tier: 'optional',
    bestTime: 'withMeal',
    category: 'Essential fatty acid',
    headline: 'Heart and joint support',
    purpose:
      'Worth adding on any week where oily fish appears less than twice; otherwise your meals already cover it.',
    servingSize: '2 softgels',
    ingredients: [
      { name: 'Fish oil concentrate', amount: '2000 mg' },
      { name: 'EPA (eicosapentaenoic acid)', amount: '660 mg' },
      { name: 'DHA (docosahexaenoic acid)', amount: '440 mg' },
      { name: 'Vitamin E (as antioxidant)', amount: '10 mg' },
    ],
    recommendation:
      'Fish oil affects how readily your blood clots, so the amount that is safe for you depends on what else you take. Check with a doctor or pharmacist before starting — particularly if you are on any blood thinner, aspirin, or have surgery scheduled.',
    benefits: [
      'Supports normal heart function',
      'Associated with reduced post-training joint soreness',
      'Fills the gap on weeks with little oily fish',
    ],
    safety: [
      'Can thin the blood. Tell your doctor before any surgery.',
      'Avoid alongside anticoagulant medication unless advised otherwise.',
      'Not suitable if you have a fish allergy.',
    ],
  },
  {
    supplementName: 'Magnesium Glycinate',
    tier: 'optional',
    bestTime: 'beforeBed',
    category: 'Mineral',
    headline: 'Sleep quality and muscle relaxation',
    purpose:
      'Training raises magnesium demand, and the glycinate form is the one that does not upset the stomach.',
    servingSize: '2 capsules',
    ingredients: [
      { name: 'Magnesium (as magnesium bisglycinate)', amount: '200 mg' },
      { name: 'Glycine', amount: '1400 mg' },
    ],
    recommendation:
      'Magnesium is cleared by the kidneys and competes with several common medicines for absorption, so the amount and the timing both matter. Ask a pharmacist what is right for you before starting, and tell them about any antibiotic, thyroid medication or diuretic you take.',
    benefits: [
      'Contributes to normal muscle function',
      'Supports the nervous system winding down at night',
      'Gentler on digestion than magnesium oxide',
    ],
    safety: [
      'High doses can loosen the stools. Reduce the amount if so.',
      'Take at least two hours apart from any antibiotic.',
    ],
  },
  {
    supplementName: 'Caffeine with L-Theanine',
    tier: 'optional',
    bestTime: 'preWorkout',
    category: 'Pre-workout',
    headline: 'Focus and training energy',
    purpose:
      'For the sessions you turn up to tired. Pair it with sleep rather than using it in place of sleep.',
    servingSize: '1 capsule',
    ingredients: [
      { name: 'Caffeine (anhydrous)', amount: '100 mg' },
      { name: 'L-Theanine', amount: '200 mg' },
    ],
    recommendation:
      'Caffeine tolerance varies enormously between people, and this sits on top of whatever coffee and tea you already drink. Talk to a doctor about what is sensible for you before starting — and do not start at all without that conversation if you have raised blood pressure, an irregular heartbeat, or are pregnant.',
    benefits: [
      'Improves perceived effort during hard sets',
      'L-theanine takes the edge off the jitters caffeine causes',
      'Effective at a dose well below most pre-workout blends',
    ],
    safety: [
      'Count it against your total daily caffeine, coffee included.',
      'Avoid entirely if you have high blood pressure or an arrhythmia.',
      'Not suitable during pregnancy.',
    ],
  },
];

/** The five macro figures, as the numeric columns store them. */
function macroColumns(macros: readonly [number, number, number, number, number]) {
  const [calories, protein, carbs, fat, fiber] = macros;
  return {
    calories: calories.toFixed(2),
    proteinG: protein.toFixed(2),
    carbsG: carbs.toFixed(2),
    fatG: fat.toFixed(2),
    fiberG: fiber.toFixed(2),
  };
}

async function seedDemoPlan(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo plan seeder must never run against production.');
  }

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error('Usage: npm run db:seed:plan -- <email>');
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Cannot seed the database.');
  }

  const ssl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1';
  const client = postgres(url, { max: 1, ssl: ssl ? 'require' : undefined });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  try {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      const known = await db.select({ email: users.email }).from(users).limit(10);
      const list = known.map((row) => `  • ${row.email}`).join('\n');
      throw new Error(
        `No user with the email "${email}".` +
          (list ? `\nAccounts in this database:\n${list}` : '\nThis database has no users yet.'),
      );
    }

    // Read from the same places the generator would, so the seeded plan is
    // consistent with what the rest of the app believes about this user.
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, user.id),
      columns: { timezone: true },
    });
    const target = await db.query.nutritionTargets.findFirst({
      where: eq(nutritionTargets.userId, user.id),
      columns: { calories: true },
    });

    const timeZone = profile?.timezone ?? 'UTC';
    const today = todayIn(timeZone);
    const weekStartDate = startOfWeek(today);
    const monthStartDate = startOfMonth(today);
    const calorieTarget = target?.calories ?? 2100;

    // ── meals ───────────────────────────────────────────────────────────────
    // Upserted on the one-plan-per-week index, so re-running replaces this
    // week's plan rather than colliding with it.
    const [mealPlan] = await db
      .insert(mealPlans)
      .values({ userId: user.id, weekStartDate, status: 'ready', calorieTarget })
      .onConflictDoUpdate({
        target: [mealPlans.userId, mealPlans.weekStartDate],
        set: { status: 'ready', calorieTarget, errorMessage: null, updatedAt: new Date() },
      })
      .returning();

    await db.delete(mealPlanItems).where(eq(mealPlanItems.mealPlanId, mealPlan.id));

    const meals: NewMealPlanItem[] = WEEK.flatMap((day, index) =>
      day.map((meal) => ({
        mealPlanId: mealPlan.id,
        dayOfWeek: index + 1,
        mealType: meal.mealType,
        scheduledTime: DEMO_TIMES[meal.mealType],
        name: meal.name,
        ...macroColumns(meal.macros),
        reasoning: meal.reasoning,
        // Left null on purpose: no image pipeline exists yet, and the screens
        // are designed to show a tinted tile in place of a photograph rather
        // than a broken frame. Seeding a URL here would hide that behaviour.
        imageUrl: null,
      })),
    );
    const insertedMeals = await db
      .insert(mealPlanItems)
      .values(meals)
      .returning({ id: mealPlanItems.id, name: mealPlanItems.name });

    // ── recipes ─────────────────────────────────────────────────────────────
    // Only the dishes {@link RECIPES} covers get one. The rest are left without,
    // which is the state a real plan is in until someone opens them: the recipe
    // screen generates on first open, and seeding every dish would hide that.
    const recipeRows: NewMealRecipe[] = insertedMeals.flatMap((meal) => {
      const recipe = RECIPES[meal.name];
      if (!recipe) return [];

      return [
        {
          mealPlanItemId: meal.id,
          summary: recipe.summary,
          cuisine: recipe.cuisine,
          difficulty: recipe.difficulty,
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          ingredients: recipe.ingredients.map((entry) => ({ ...entry })),
          steps: recipe.steps.map((step) => ({ ...step })),
          tips: [...recipe.tips],
        },
      ];
    });

    if (recipeRows.length > 0) {
      // The meals were deleted and rewritten above, so their recipes went with
      // them on the cascade — there is nothing here to conflict with.
      await db.insert(mealRecipes).values(recipeRows);
    }

    // ── supplements ─────────────────────────────────────────────────────────
    const [supplementPlan] = await db
      .insert(supplementPlans)
      .values({ userId: user.id, monthStartDate, status: 'ready' })
      .onConflictDoUpdate({
        target: [supplementPlans.userId, supplementPlans.monthStartDate],
        set: { status: 'ready', errorMessage: null, updatedAt: new Date() },
      })
      .returning();

    await db
      .delete(supplementPlanItems)
      .where(eq(supplementPlanItems.supplementPlanId, supplementPlan.id));

    const supplements: NewSupplementPlanItem[] = SUPPLEMENTS.map((item) => ({
      supplementPlanId: supplementPlan.id,
      supplementName: item.supplementName,
      tier: item.tier,
      bestTime: item.bestTime,
      category: item.category,
      headline: item.headline,
      purpose: item.purpose,
      servingSize: item.servingSize,
      ingredients: item.ingredients.map((entry) => ({ ...entry })),
      recommendation: withDisclaimer(item.recommendation),
      benefits: [...item.benefits],
      safety: [...item.safety],
      brand: item.brand ?? null,
      rating: item.rating?.toFixed(1) ?? null,
      ratingCount: item.ratingCount ?? null,
      imageUrl: null,
    }));
    await db.insert(supplementPlanItems).values(supplements);

    console.log(`Demo plans seeded for ${email} (time zone ${timeZone}).`);
    console.log(
      `  Meal plan       ${weekStartDate}  — ${meals.length} meals across 7 days, ` +
        `${recipeRows.length} with a recipe`,
    );
    console.log(`  Supplement plan ${monthStartDate} — ${supplements.length} supplements`);
    console.log('\nOpen the Planning tab. Both plans read as ready; no model call was made.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

seedDemoPlan().catch((error: unknown) => {
  console.error('Demo plan seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
