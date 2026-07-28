import type { CoachConversation, CoachMessage } from '../database/schema';
import { COACH_PERSONALITIES, type CoachPersonality } from './coach.personality';

/** Client-facing shapes for the AI health coach. */

export interface CoachConversationView {
  id: string;
  personality: CoachPersonality;
  /** Display name of the personality, e.g. "The Scientist". */
  personalityLabel: string;
  title: string;
  createdAt: string;
  /** Bumped on every message, so a thread list can order by real recency. */
  updatedAt: string;
}

export interface CoachMessageView {
  id: string;
  role: CoachMessage['role'];
  content: string;
  createdAt: string;
}

/** One personality as offered in a picker. */
export interface CoachPersonalityView {
  id: CoachPersonality;
  label: string;
  tagline: string;
}

/**
 * Events the message stream emits.
 *
 * A discriminated union rather than raw text: the client has to distinguish
 * "here is more of the answer" from "the answer is complete, here is its id" and
 * from "generation failed" — and it must be able to do so *after* a 200 has
 * already been sent, which is the one thing a status code cannot express.
 */
export type CoachStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; messageId: string; content: string }
  | { type: 'error'; message: string };

export function toCoachConversationView(row: CoachConversation): CoachConversationView {
  return {
    id: row.id,
    personality: row.personality,
    personalityLabel: COACH_PERSONALITIES[row.personality].label,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCoachMessageView(row: CoachMessage): CoachMessageView {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The personality catalogue, for the picker shown when starting a thread. */
export function listPersonalities(): CoachPersonalityView[] {
  return (Object.keys(COACH_PERSONALITIES) as CoachPersonality[]).map((id) => ({
    id,
    label: COACH_PERSONALITIES[id].label,
    tagline: COACH_PERSONALITIES[id].tagline,
  }));
}
