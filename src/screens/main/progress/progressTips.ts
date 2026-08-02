import type { ProgressOverview } from '@/services/progress/progressService';
import { colors } from '@/theme';
import type { MaterialIconName } from '@/utils/icons';

/**
 * The Tips tab.
 *
 * Each tip is chosen from the period's own figures and states the number it was
 * chosen for, so the user can check it against the charts on the other two tabs.
 * That is the whole point of the tab: advice that could have been written before
 * the account existed is not advice, and the previous fixed list ("you often
 * fall short in the morning") asserted things about the user it had no way to
 * know.
 *
 * Generic closing tips fill the list out when the account is too new to have a
 * pattern worth naming — they are framed as general guidance, never as an
 * observation.
 */

export interface Tip {
  key: string;
  icon: MaterialIconName;
  color: string;
  title: string;
  body: string;
}

/** How many tips the tab shows. */
const TIP_COUNT = 3;

/** Reads the leading number out of a pre-formatted figure ("1,880", "3.3 L"). */
function parseLeading(value: string): number {
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Advice that holds for anyone, used only to fill the list out. */
const GENERAL_TIPS: Tip[] = [
  {
    key: 'protein-spread',
    icon: 'food-drumstick',
    color: colors.accent.violet,
    title: 'Spread your protein',
    body: '25–30 g per meal is absorbed better than the same total eaten in one sitting, and it keeps you full between meals.',
  },
  {
    key: 'sleep',
    icon: 'moon-waning-crescent',
    color: colors.accent.orange,
    title: 'Guard your sleep',
    body: 'Consistent 7–8 hour nights do more for recovery and appetite control than any supplement.',
  },
  {
    key: 'consistency',
    icon: 'calendar-check',
    color: colors.accent.green,
    title: 'Log every day',
    body: 'Days you do not log are days the trends cannot see. Even a rough entry keeps your averages honest.',
  },
];

export function tipsFor(overview: ProgressOverview): Tip[] {
  const { charts, macros, fitnessStats, healthScore } = overview;
  const window = overview.period === 'week' ? 'this week' : 'this month';
  const derived: Tip[] = [];

  const waterAverage = mean(charts.water.data);
  const waterTarget = parseLeading(charts.water.target);
  if (waterTarget > 0 && waterAverage < waterTarget * 0.8) {
    derived.push({
      key: 'water',
      icon: 'cup-water',
      color: colors.accent.cyan,
      title: 'Drink more water',
      body: `You averaged ${waterAverage.toFixed(1)} L a day ${window} against a ${charts.water.target} target. A glass on waking and one with each meal closes most of that gap.`,
    });
  }

  const fiber = macros.find((macro) => macro.key === 'fiber');
  if (fiber && fiber.grams < 20) {
    derived.push({
      key: 'fiber',
      icon: 'leaf',
      color: colors.accent.green,
      title: 'Add more fiber',
      body: `Fiber averaged ${Math.round(fiber.grams)} g a day ${window}. Beans, oats and a portion of vegetables at two meals is the simplest way up.`,
    });
  }

  const protein = macros.find((macro) => macro.key === 'protein');
  if (protein && protein.percent < 25) {
    derived.push({
      key: 'protein',
      icon: 'food-drumstick',
      color: colors.accent.violet,
      title: 'Lead with protein',
      body: `Protein was ${protein.percent}% of the macros you logged ${window}. Building each meal around a protein source is the change with the largest effect here.`,
    });
  }

  const sessions = parseLeading(fitnessStats.sessions.value);
  if (sessions === 0) {
    derived.push({
      key: 'move',
      icon: 'run',
      color: colors.accent.orange,
      title: 'Get one session in',
      body: `No workouts logged ${window}. One 20-minute session is enough to start the trend — the first is the only hard one.`,
    });
  }

  const caloriesAverage = parseLeading(charts.calories.average);
  const calorieTarget = parseLeading(charts.calories.target);
  if (calorieTarget > 0 && caloriesAverage > calorieTarget * 1.1) {
    derived.push({
      key: 'calories',
      icon: 'fire',
      color: colors.accent.red,
      title: 'Ease back on portions',
      body: `Intake averaged ${charts.calories.average} kcal against ${charts.calories.target}. Trimming one snack a day covers most of the difference without changing your meals.`,
    });
  }

  if (healthScore.value !== null && healthScore.value >= 80 && derived.length === 0) {
    derived.push({
      key: 'holding',
      icon: 'trophy-outline',
      color: colors.accent.green,
      title: 'Keep doing what you are doing',
      body: `Your health score averaged ${healthScore.value} ${window}. Nothing here needs fixing — protect the routine that produced it.`,
    });
  }

  const filler = GENERAL_TIPS.filter((tip) => !derived.some((item) => item.key === tip.key));
  return [...derived, ...filler].slice(0, TIP_COUNT);
}
