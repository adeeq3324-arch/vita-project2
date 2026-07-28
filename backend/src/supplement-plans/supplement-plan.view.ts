import type { SupplementPlan, SupplementPlanItem } from '../database/schema';

/**
 * Client-facing shapes for a monthly supplement regimen.
 *
 * Items are grouped by time of day as well as listed flat: the plan screen shows
 * a "morning / afternoon / evening / with a meal" schedule, and grouping here
 * keeps that ordering identical everywhere it is rendered.
 */

export interface SupplementItemView {
  id: string;
  name: string;
  bestTime: SupplementPlanItem['bestTime'];
  /** Dosage range, timing rationale, tips and the disclaimer, as one piece. */
  guidance: string;
  purpose: string;
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
  /** Flat list, most important first. */
  items: SupplementItemView[];
  /** The same items arranged as a daily schedule. */
  schedule: SupplementScheduleGroup[];
  createdAt: string;
  updatedAt: string;
}

/** Display order and heading for each slot in the day. */
const SCHEDULE: readonly { bestTime: SupplementPlanItem['bestTime']; label: string }[] = [
  { bestTime: 'morning', label: 'Morning' },
  { bestTime: 'afternoon', label: 'Afternoon' },
  { bestTime: 'evening', label: 'Evening' },
  { bestTime: 'withMeal', label: 'With a meal' },
];

export function toSupplementPlanStatusView(plan: SupplementPlan): SupplementPlanStatusView {
  return { supplementPlanId: plan.id, status: plan.status, error: plan.errorMessage };
}

export function toSupplementPlanView(
  plan: SupplementPlan,
  rows: readonly SupplementPlanItem[],
): SupplementPlanView {
  const items = rows.map(toItemView);

  return {
    ...toSupplementPlanStatusView(plan),
    monthStartDate: plan.monthStartDate,
    items,
    // Empty slots are dropped: a heading with nothing under it is noise.
    schedule: SCHEDULE.map(({ bestTime, label }) => ({
      bestTime,
      label,
      items: items.filter((item) => item.bestTime === bestTime),
    })).filter((group) => group.items.length > 0),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toItemView(item: SupplementPlanItem): SupplementItemView {
  return {
    id: item.id,
    name: item.supplementName,
    bestTime: item.bestTime,
    guidance: item.guidance,
    purpose: item.purpose,
  };
}
