import type { OnboardingData } from '@/context/OnboardingContext';

/**
 * What an empty thread opens with.
 *
 * The greeting and the suggestion chips are interface copy, not answers: they
 * are never sent to the model, never stored in the conversation, and cost
 * nothing to show. Every real reply comes from the coach on the server.
 *
 * They are written in English because the rest of the app is, and because the
 * chips are only a way in — the coach answers in whatever language the user
 * types or speaks, from their first message onwards.
 */

function firstName(data: OnboardingData): string {
  return data.username.trim().split(/\s+/)[0] || 'there';
}

export function greeting(data: OnboardingData): string {
  return `Hi ${firstName(data)}! 👋\nAsk me anything about your health — in whatever language you prefer.`;
}

/**
 * Openers, chosen for the user's goal.
 *
 * One of them is always about meals or supplements, because what the coach does
 * with that question — hand it to the Planning tab, where the plan is actually
 * built — is the part of this screen a new user would otherwise never find.
 */
export function suggestions(data: OnboardingData): string[] {
  const planning =
    data.goal === 'muscle_gain' ? 'What should I eat to gain muscle?' : 'What should I eat today?';

  const goalSpecific =
    data.goal === 'muscle_gain'
      ? 'How do I train for muscle growth?'
      : data.goal === 'weight_loss'
        ? 'How fast should I be losing weight?'
        : 'How can I have more energy each day?';

  return [goalSpecific, planning, 'Give me one tip for my goal'];
}
