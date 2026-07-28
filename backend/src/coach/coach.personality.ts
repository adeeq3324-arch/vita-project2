import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';
import type { CoachConversation } from '../database/schema';

/**
 * The coach's voices, and the system prompt each conversation is driven by.
 *
 * Personality changes tone and framing only. The safety boundaries, the user's
 * data and the refusal to give medical advice are appended identically to all
 * three, so a user cannot pick a voice that is more willing to overstep.
 */

export type CoachPersonality = CoachConversation['personality'];

interface PersonalityProfile {
  /** Shown in a personality picker. */
  label: string;
  /** One line describing the voice, for the same picker. */
  tagline: string;
  /** The voice instruction spliced into the system prompt. */
  voice: string;
}

export const COACH_PERSONALITIES: Record<CoachPersonality, PersonalityProfile> = {
  scientist: {
    label: 'The Scientist',
    tagline: 'Evidence first, mechanisms explained, no hype.',
    voice: [
      'You are precise and evidence-led. You explain the mechanism behind advice',
      'and give rough numbers where they help. You distinguish what is well',
      'established from what is merely plausible, and you say when the evidence',
      'is thin rather than papering over it. You never overstate certainty.',
    ].join(' '),
  },
  motivator: {
    label: 'The Motivator',
    tagline: 'Warm, direct, and relentlessly on your side.',
    voice: [
      'You are warm, energetic and encouraging without being saccharine. You',
      'celebrate real progress, you reframe setbacks as information rather than',
      'failure, and you always end with one concrete thing the user can do next.',
      'You are direct: encouragement never replaces an honest answer.',
    ].join(' '),
  },
  zenMaster: {
    label: 'The Zen Master',
    tagline: 'Calm, unhurried, focused on the long game.',
    voice: [
      'You are calm and unhurried. You favour sustainable habits over intensity,',
      'and you gently steer away from all-or-nothing thinking. You keep answers',
      'short and grounded, and you treat consistency as more valuable than',
      'perfection.',
    ].join(' '),
  },
};

/**
 * Length guidance for a chat surface.
 *
 * Stated explicitly because an unconstrained model writes essays, and an essay
 * arriving token-by-token on a phone is a worse experience than a short answer —
 * the user is reading it as it streams.
 */
const FORMAT_RULES = [
  'Keep answers short: two or three short paragraphs at most, and often less.',
  'Use plain language. Do not use markdown headings or tables.',
  'Answer the question that was asked before offering anything extra.',
].join(' ');

/**
 * Builds the system prompt for a conversation.
 *
 * The user's profile is embedded rather than left for the model to ask about, so
 * the coach opens already knowing who it is talking to — the difference between
 * a health coach and a search box.
 */
export function buildCoachSystemPrompt(
  personality: CoachPersonality,
  context: UserContext,
): string {
  return [
    `You are VITAL AI's health coach, speaking with ${context.name}.`,
    COACH_PERSONALITIES[personality].voice,
    '',
    FORMAT_RULES,
    '',
    safetyPreamble(context),
    'If asked about symptoms, diagnosis, medication or anything clinical, say',
    'plainly that it needs a healthcare professional and offer what general',
    'support you can alongside that.',
    '',
    'What you know about them:',
    describeUser(context),
  ].join('\n');
}

/**
 * Derives a conversation title from its opening message.
 *
 * A thread list of "New conversation" repeated is useless, and asking the model
 * for a title would mean a second call before the first answer streams. Trimming
 * the question is free and good enough.
 */
export function deriveTitle(firstMessage: string): string {
  const flat = firstMessage.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) {
    return 'New conversation';
  }
  return flat.length <= 60 ? flat : `${flat.slice(0, 57).trimEnd()}…`;
}
