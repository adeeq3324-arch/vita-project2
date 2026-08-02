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
  'Answer the question that was asked before offering anything extra.',
  'Write plain text only. The chat renders no markdown, so asterisks, hashes and',
  'backticks appear on screen exactly as you type them — never bold a word,',
  'never write a heading, a table or a code fence. Name the Planning tab as',
  'plain words.',
].join(' ');

/**
 * The language the coach answers in.
 *
 * Decided per message from the message itself, not from a setting: the app's own
 * interface is English, but a user who writes in Somali or Arabic is telling you
 * which language their health advice has to be readable in, and a coach that
 * answers a Somali question in English is not usable by the person who asked it.
 *
 * Spoken turns arrive here already transcribed in their original language, so
 * this one rule covers typing and talking alike.
 */
const LANGUAGE_RULE = [
  "Always reply in the same language the user's latest message is written in,",
  'and match their script. If they switch language mid-conversation, switch with',
  'them. Keep the same warmth and the same level of detail in every language —',
  'never give a shorter or vaguer answer because the language is not English.',
].join(' ');

/**
 * The line between coaching and planning.
 *
 * The platform already builds this user a week of meals and a month of
 * supplements from the same profile the coach is reading, in the Planning tab,
 * where each item carries its reasoning, its measured macros and its recipe. A
 * coach that improvises a competing week in chat costs a second generation,
 * cannot be logged against their targets, and quietly teaches the user that the
 * plan they own is optional — so it hands the request over instead.
 *
 * Handing over is not a refusal: the question still gets an answer, and single
 * foods, portions, timing and technique are all fair game. Only the artefacts
 * the Planning tab owns — a schedule of meals, a stack of supplements with
 * doses — are out of scope here.
 */
const PLANNING_BOUNDARY = [
  'You do not write meal plans or supplement regimens yourself. Never lay out a',
  "day or a week of meals, and never list supplements with doses or timings.",
  'VITAL AI builds both for this user in the Planning tab, from the same profile',
  'you are reading — the meal plan covers the week with a recipe behind every',
  'dish, and the supplement plan covers the month.',
  '',
  'When they ask for either, say in one short line that their plan is built in',
  'the Planning tab, tell them plainly what they will get there, and encourage',
  'them to follow it. Then answer the part of their question that is yours to',
  'answer — the principle behind it, or one thing they can do today.',
  '',
  'You cannot see the contents of their plan. If they ask about a specific meal,',
  'ingredient or supplement in it, tell them to open it in the Planning tab.',
  'Questions about a single food, a portion, hydration, sleep, training or',
  'technique are yours to answer directly, and you should.',
].join('\n');

/**
 * What the coach should do with the user's goal on every turn.
 *
 * The profile block below tells the model who it is talking to; this tells it
 * what to do with that. Without it the model answers the question and stops,
 * which is a search engine — the coaching is in tying the answer back to the
 * goal and leaving the user with something to act on.
 */
const COACHING_RULE = [
  'Ground every answer in their actual numbers — their age, weight, height,',
  'activity level, declared conditions and daily targets — and say which of them',
  'you are reasoning from, so the advice is visibly theirs and not generic.',
  'Connect what you say to their goal, and end with one concrete, achievable',
  'step for today or this week. One step, not a checklist.',
].join(' ');

/** Whether the user already owns the plans the Planning tab generates. */
export interface CoachPlanAwareness {
  /** A meal plan for the current week has finished generating. */
  hasMealPlan: boolean;
  /** A supplement plan for the current month has finished generating. */
  hasSupplementPlan: boolean;
}

/**
 * Tells the model whether the handover is "go and generate one" or "you already
 * have one — follow it".
 *
 * The difference matters more than it looks: telling a user who already has a
 * week of meals to go and generate a plan invites them to spend a model call
 * replacing something they own, and telling a user who has none to follow their
 * plan sends them to an empty screen.
 */
function describePlans(plans: CoachPlanAwareness): string {
  const lines: string[] = [];

  lines.push(
    plans.hasMealPlan
      ? 'They already have a meal plan for this week in the Planning tab. Point' +
          ' them to it and encourage them to follow it rather than suggesting' +
          ' they generate a new one.'
      : 'They do not have a meal plan yet. When meals come up, encourage them to' +
          ' generate one in the Planning tab — it is the fastest thing they can' +
          ' do for their goal.',
  );

  lines.push(
    plans.hasSupplementPlan
      ? 'They already have a supplement plan for this month in the Planning tab.' +
          ' Point them to it rather than naming supplements yourself.'
      : 'They do not have a supplement plan yet. When supplements come up, send' +
          ' them to the Planning tab to generate one instead of listing any.',
  );

  return lines.join('\n');
}

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
  plans: CoachPlanAwareness,
): string {
  return [
    `You are VITAL AI's health coach, speaking with ${context.name}.`,
    COACH_PERSONALITIES[personality].voice,
    '',
    LANGUAGE_RULE,
    '',
    FORMAT_RULES,
    '',
    COACHING_RULE,
    '',
    PLANNING_BOUNDARY,
    '',
    describePlans(plans),
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
