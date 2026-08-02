import type {
  SupplementIngredient,
  SupplementPlan,
  SupplementPlanItem,
} from '../database/schema';

/**
 * Client-facing shapes for a monthly supplement regimen.
 *
 * Items are grouped by time of day as well as listed flat: the plan screen shows
 * a daily schedule, and grouping here keeps that ordering identical everywhere it
 * is rendered. The timing's display label is resolved on the server for the same
 * reason — "Post-workout" is one decision, not one per surface that shows it.
 */

export interface SupplementItemView {
  id: string;
  name: string;
  /** Whether the regimen depends on this item or merely offers it. */
  tier: SupplementPlanItem['tier'];
  /** What kind of supplement this is, e.g. "Protein supplement". */
  category: string;
  /** The single benefit it is taken for, e.g. "Muscle recovery & growth". */
  headline: string;
  bestTime: SupplementPlanItem['bestTime'];
  /** Ready-made label for the timing, e.g. "Post-workout". */
  bestTimeLabel: string;
  /** What one serving is, e.g. "1 scoop (30 g)". */
  servingSize: string;
  /** The facts panel: every compound in a serving, with its amount. */
  ingredients: SupplementIngredient[];
  purpose: string;
  /**
   * The closing advice — see a healthcare provider and agree an amount with them
   * before starting. Always carries the standing disclaimer, so any surface that
   * renders the supplement can render this and be complete.
   */
  recommendation: string;
  /** Short, concrete claims — rendered as a checklist. */
  benefits: string[];
  /**
   * Cautions specific to this supplement. The standing "not medical advice"
   * disclaimer is not repeated here — it travels inside `recommendation`, which
   * every surface showing the supplement has to render anyway.
   */
  safety: string[];
  /**
   * Product identity, populated only when a real catalogue backs this item.
   * Null everywhere else: the client omits what is missing rather than showing
   * an endorsement nobody made.
   */
  brand: string | null;
  rating: number | null;
  ratingCount: number | null;
  imageUrl: string | null;
}

export interface SupplementScheduleGroup {
  bestTime: SupplementPlanItem['bestTime'];
  /** Ready-made heading, e.g. "With a meal". */
  label: string;
  items: SupplementItemView[];
}

/** Status-only payload, for polling while generation is in flight. */
export interface SupplementPlanStatusView {
  supplementPlanId: string;
  status: SupplementPlan['status'];
  /** Present only when generation failed. */
  error: string | null;
}

export interface SupplementPlanView extends SupplementPlanStatusView {
  monthStartDate: string;
  /** Month the plan covers, ready to render: "July 2025". */
  monthLabel: string;
  /** Flat list, most important first. */
  items: SupplementItemView[];
  /** The same items arranged as a daily schedule. */
  schedule: SupplementScheduleGroup[];
  /** How many items fall in each tier, for the plan screen's filter chips. */
  counts: { all: number; core: number; optional: number };
  createdAt: string;
  updatedAt: string;
}

/** Display order and heading for each slot in the day. */
const SCHEDULE: readonly { bestTime: SupplementPlanItem['bestTime']; label: string }[] = [
  { bestTime: 'morning', label: 'Morning' },
  { bestTime: 'preWorkout', label: 'Pre-workout' },
  { bestTime: 'postWorkout', label: 'Post-workout' },
  { bestTime: 'withMeal', label: 'With meals' },
  { bestTime: 'afternoon', label: 'Afternoon' },
  { bestTime: 'evening', label: 'Evening' },
  { bestTime: 'beforeBed', label: 'Before bed' },
];

const TIME_LABELS: Record<SupplementPlanItem['bestTime'], string> = Object.fromEntries(
  SCHEDULE.map((slot) => [slot.bestTime, slot.label]),
) as Record<SupplementPlanItem['bestTime'], string>;

export function toSupplementPlanStatusView(plan: SupplementPlan): SupplementPlanStatusView {
  return { supplementPlanId: plan.id, status: plan.status, error: plan.errorMessage };
}

export function toSupplementPlanView(
  plan: SupplementPlan,
  rows: readonly SupplementPlanItem[],
): SupplementPlanView {
  const items = rows.map(toSupplementItemView);

  return {
    ...toSupplementPlanStatusView(plan),
    monthStartDate: plan.monthStartDate,
    monthLabel: monthLabel(plan.monthStartDate),
    items,
    // Empty slots are dropped: a heading with nothing under it is noise.
    schedule: SCHEDULE.map(({ bestTime, label }) => ({
      bestTime,
      label,
      items: items.filter((item) => item.bestTime === bestTime),
    })).filter((group) => group.items.length > 0),
    counts: {
      all: items.length,
      core: items.filter((item) => item.tier === 'core').length,
      optional: items.filter((item) => item.tier === 'optional').length,
    },
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function toSupplementItemView(item: SupplementPlanItem): SupplementItemView {
  return {
    id: item.id,
    name: item.supplementName,
    tier: item.tier,
    category: item.category,
    headline: item.headline,
    bestTime: item.bestTime,
    bestTimeLabel: TIME_LABELS[item.bestTime] ?? 'Anytime',
    servingSize: item.servingSize,
    ingredients: item.ingredients,
    purpose: item.purpose,
    recommendation: item.recommendation,
    benefits: item.benefits,
    safety: item.safety,
    brand: item.brand,
    rating: item.rating === null ? null : Number(item.rating),
    ratingCount: item.ratingCount,
    imageUrl: item.imageUrl,
  };
}

/** "July 2025" — the month a plan covers, from its `YYYY-MM-01` start date. */
function monthLabel(monthStartDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${monthStartDate}T00:00:00Z`));
}
