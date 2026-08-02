import type { HomeFeed, HomeMetric } from '@/services/home/homeService';

/**
 * Presentation helpers for the Home tab.
 *
 * Every number on the screen now comes from `GET /home/feed`; what is left here
 * is the formatting the API deliberately does not do — turning a value and its
 * unit into the two lines a tile shows, and picking the day to ask for.
 */

/** Full weekday names indexed by `Date.getDay()` (0 = Sunday). */
const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** "Today" for the current day, otherwise the full weekday name. */
export function dayLabel(date: Date): string {
  return isToday(date) ? 'Today' : WEEKDAY_FULL[date.getDay()]!;
}

/**
 * The device's calendar day as `YYYY-MM-DD`.
 *
 * Built from the local parts rather than `toISOString()`, which converts to UTC
 * first and so returns the wrong day for anyone whose offset pushes them across
 * midnight — the exact users a health app must not silently show yesterday to.
 */
export function toCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** The tile's headline figure: "1,820", "2.1". */
export function metricValue(metric: HomeMetric): string {
  return formatNumber(metric.value, metric.decimals);
}

/** The line beneath it: "/ 2,300 kcal". */
export function metricTarget(metric: HomeMetric): string {
  const target = formatNumber(metric.target, metric.decimals);
  return `/ ${target}${metric.unit ? ` ${metric.unit}` : ''}`;
}

/**
 * The insight panel's copy, derived from the day's own figures.
 *
 * Deliberately arithmetic rather than generated: until the AI layer is
 * configured, a sentence the user can check against the numbers directly above
 * it is worth more than a plausible-sounding one that was written before their
 * account existed. The AI coach replaces this with a model-authored insight;
 * the shape it returns is the same.
 */
export function insightFor(feed: HomeFeed): { title: string; message: string } {
  const title = 'Daily Insight';
  const { intake, targets } = feed;

  if (!targets) {
    return {
      title,
      message: 'Complete your profile to get daily calorie and macro targets tailored to you.',
    };
  }

  if (intake.mealCount === 0) {
    return {
      title,
      message: `Nothing logged for ${feed.dayLabel.toLowerCase()} yet. Log a meal and your calories, macros and health score update straight away.`,
    };
  }

  const proteinLeft = Math.round(targets.protein - intake.protein);
  if (proteinLeft > 0 && intake.protein < targets.protein * 0.6) {
    return {
      title,
      message: `You are ${proteinLeft} g of protein short of your ${targets.protein} g target. A protein-led next meal closes most of that gap.`,
    };
  }

  const caloriesLeft = Math.round(targets.calories - intake.kcal);
  if (caloriesLeft < 0) {
    return {
      title,
      message: `You are ${Math.abs(caloriesLeft)} kcal over your ${targets.calories.toLocaleString()} kcal target. A lighter evening keeps the week on track.`,
    };
  }

  if (intake.fiber < targets.fiber * 0.5) {
    return {
      title,
      message: `Fiber is at ${Math.round(intake.fiber)} g of ${targets.fiber} g. Vegetables, beans or fruit with your next meal is the easiest fix.`,
    };
  }

  return {
    title,
    message: `${caloriesLeft.toLocaleString()} kcal left today across ${Math.max(targets.mealsPerDay - intake.mealCount, 0)} remaining meals. You are on track — keep it steady.`,
  };
}

/**
 * Closing quote. Static by design: it is generic encouragement, not a claim
 * about the user, so it is the one thing on this screen that does not need to
 * come from their account. The name below it does.
 */
const QUOTE_BY_WEEKDAY = [
  'Rest is part of the work. Recover well, come back stronger.',
  'A strong week starts with a single good choice.',
  'Small steps every day add up to big results.',
  'Discipline is choosing what you want most over what you want now.',
  'You are closer than you were yesterday.',
  'Finish the week proud of the effort you gave.',
  'Consistency on the weekend is what sets you apart.',
] as const;

export function motivationFor(date: Date, name: string): { quote: string; author: string } {
  return {
    quote: QUOTE_BY_WEEKDAY[date.getDay()]!,
    author: name ? `Stay consistent, ${name}` : 'Stay consistent',
  };
}
