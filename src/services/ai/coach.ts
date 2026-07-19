import type { OnboardingData } from '@/context/OnboardingContext';

import { calorieTarget, conditionNote, firstName, goalLabel, proteinTarget } from './profile';

/**
 * Conversational AI Coach generator.
 *
 * Replies are assembled locally from the user's onboarding profile as a stand-
 * in for the AI service configured in the environment; the wiring (types,
 * personalisation, async shape) matches what the server-side model will return.
 */

export function coachGreeting(data: OnboardingData): string {
  return `Hi ${firstName(data)}! 👋\nHow can I help you today?`;
}

/** Suggested prompts, tuned to the user's goal. */
export function coachSuggestions(data: OnboardingData): string[] {
  const common = ['What should I eat today?', 'Plan my workout'];
  if (data.goal === 'muscle_gain') return ['How do I gain muscle?', ...common];
  if (data.goal === 'weight_loss') return ['What can I eat to lose weight?', ...common];
  return ['How can I stay healthy?', ...common];
}

type Rule = { match: RegExp; reply: (data: OnboardingData) => string };

const bullets = (items: string[]) => items.map((i) => `•  ${i}`).join('\n');

const rules: Rule[] = [
  {
    match: /(lose weight|weight loss|burn fat|slim)/i,
    reply: (data) =>
      `Great question! Based on your goal to ${goalLabel(data.goal).toLowerCase()} and your profile, here are some recommendations:\n\n${bullets([
        'High protein foods',
        'Plenty of vegetables',
        'Whole grains',
        'Healthy fats',
      ])}\n\nAim for around ${calorieTarget(data)} kcal a day. ${conditionNote(data)}\nWould you like me to create a meal plan for you?`,
  },
  {
    match: /(gain muscle|build muscle|bulk|stronger|strength)/i,
    reply: (data) =>
      `To build muscle, ${firstName(data)}, focus on progressive training and enough fuel:\n\n${bullets([
        `Hit ~${proteinTarget(data)}g of protein daily`,
        'Eat in a slight calorie surplus',
        'Train each muscle 2× per week',
        'Prioritise sleep and recovery',
      ])}\n\n${conditionNote(data)}\nWant a 7-day plan tailored to this?`,
  },
  {
    match: /(eat|meal|food|breakfast|lunch|dinner|diet)/i,
    reply: (data) =>
      `Here's what I'd suggest eating today for your ${goalLabel(data.goal).toLowerCase()} goal:\n\n${bullets([
        'Breakfast: Greek yogurt, berries & oats',
        'Lunch: Grilled chicken salad with quinoa',
        'Dinner: Salmon with roasted vegetables',
        'Snack: A handful of nuts or fruit',
      ])}\n\nThat lands near your ${calorieTarget(data)} kcal target. ${conditionNote(data)}`.trim(),
  },
  {
    match: /(workout|exercise|train|gym|cardio)/i,
    reply: (data) =>
      `Here's a balanced week to match your goal:\n\n${bullets([
        'Mon: Upper body strength',
        'Tue: Zone-2 cardio, 30 min',
        'Thu: Lower body strength',
        'Sat: Full-body circuit',
      ])}\n\nWarm up well and progress gradually. ${conditionNote(data)}`.trim(),
  },
  {
    match: /(water|hydrate|drink)/i,
    reply: (data) =>
      `Aim for about 3 litres of water a day, ${firstName(data)} — a little more on training days. Start with a glass when you wake up to close the morning gap.`,
  },
  {
    match: /(supplement|vitamin|protein powder)/i,
    reply: (data) =>
      `For your goal, a simple, evidence-based stack works best:\n\n${bullets([
        'Vitamin D3 — daily',
        'Omega-3 — with a meal',
        'Whey or plant protein — around training',
      ])}\n\n${conditionNote(data) || 'Check the Planning tab for your full schedule.'}`.trim(),
  },
];

/** Generate the assistant's reply to a free-text question. */
export function coachReply(question: string, data: OnboardingData): string {
  const rule = rules.find((r) => r.match.test(question));
  if (rule) return rule.reply(data);
  return `I'm here to help you ${goalLabel(data.goal).toLowerCase() === 'healthy lifestyle' ? 'stay healthy' : goalLabel(data.goal).toLowerCase()}, ${firstName(data)}. Ask me about meals, workouts, hydration or supplements and I'll tailor it to your profile.`;
}
