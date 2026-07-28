import type { AccentColor, ReminderCategory } from '../database/schema';

/**
 * Defaults per reminder category: how it is drawn, and what it says when the user
 * writes no message of their own.
 *
 * One table rather than three so a category cannot exist with an icon but no
 * default body — which would be a push notification with an empty message.
 */
interface ReminderCategoryProfile {
  icon: string;
  accent: AccentColor;
  /** Notification body used when the reminder carries no custom message. */
  message: string;
}

const CATEGORIES: Record<ReminderCategory, ReminderCategoryProfile> = {
  meal: {
    icon: 'silverware-fork-knife',
    accent: 'red',
    message: 'Time to eat — log your meal to keep today on track.',
  },
  water: {
    icon: 'cup-water',
    accent: 'cyan',
    message: 'Have a glass of water and top up your hydration.',
  },
  workout: {
    icon: 'dumbbell',
    accent: 'green',
    message: "Your session is due. Twenty minutes still counts.",
  },
  supplement: {
    icon: 'pill',
    accent: 'violet',
    message: 'Time for your supplement.',
  },
  weighIn: {
    icon: 'scale-bathroom',
    accent: 'orange',
    message: 'Step on the scales to keep your trend accurate.',
  },
  sleep: {
    icon: 'moon-waning-crescent',
    accent: 'violet',
    message: 'Time to wind down — recovery is part of the plan.',
  },
  custom: {
    icon: 'bell-ring',
    accent: 'violet',
    message: "Here's your reminder.",
  },
};

export function reminderIcon(category: ReminderCategory): string {
  return CATEGORIES[category].icon;
}

export function reminderAccent(category: ReminderCategory): AccentColor {
  return CATEGORIES[category].accent;
}

export function reminderDefaultMessage(category: ReminderCategory): string {
  return CATEGORIES[category].message;
}
