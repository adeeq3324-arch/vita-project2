import * as z from 'zod';
import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';

/**
 * The contract and prompt for a monthly supplement regimen.
 *
 * Supplements are the most safety-sensitive thing the platform generates: an
 * over-confident dosage read as an instruction is a real-world harm, not a bad
 * recommendation. The schema and prompt below are shaped around that — guidance
 * is one piece of hedged prose rather than a dose field, and the disclaimer is
 * appended by code after generation rather than being left to the model to
 * remember.
 */

const BEST_TIMES = ['morning', 'afternoon', 'evening', 'withMeal'] as const;

/**
 * The sentence every item ends with.
 *
 * Appended in code, not requested in the prompt, because a disclaimer that
 * depends on the model complying is not a disclaimer. Exported so the appending
 * logic and any test can agree on the exact wording.
 */
export const SUPPLEMENT_DISCLAIMER =
  'This is general wellness information, not medical advice — check with a ' +
  'healthcare provider before starting any supplement, especially if you take ' +
  'medication or have a health condition.';

export const supplementItemSchema = z.object({
  supplementName: z
    .string()
    .min(2)
    .max(120)
    .describe('Common name of the supplement, e.g. "Vitamin D3"'),
  bestTime: z.enum(BEST_TIMES).describe('When in the day it is best taken'),
  guidance: z
    .string()
    .min(40)
    .max(900)
    .describe(
      'Two to four sentences covering a typical dosage range, why that timing ' +
        'suits it, and any practical tip such as taking it with fat or away ' +
        'from other minerals. Phrased as guidance, never as a prescription.',
    ),
  purpose: z
    .string()
    .min(10)
    .max(240)
    .describe('One line on why this is suggested for this particular person'),
});

export const supplementPlanGenerationSchema = z.object({
  items: z
    .array(supplementItemSchema)
    .min(1)
    .max(8)
    .describe('The suggested regimen, most important first'),
});

export type SupplementPlanGeneration = z.infer<typeof supplementPlanGenerationSchema>;
export type GeneratedSupplementItem = z.infer<typeof supplementItemSchema>;

export const SUPPLEMENT_SYSTEM_PROMPT = [
  'You are a cautious, evidence-led nutrition adviser for a health and fitness',
  'platform. You suggest only well-studied, widely available supplements, you',
  'state dosages as ranges rather than instructions, and you say plainly when',
  'food is the better source. You never suggest anything that interacts with a',
  'declared health condition. You output data, never prose.',
].join(' ');

/**
 * Builds the generation prompt for one user's month.
 *
 * The cap on the number of items is a safety constraint rather than a formatting
 * one: a long stack is both harder to adhere to and more likely to interact, so
 * the prompt asks for the few that are actually justified.
 */
export function buildSupplementPrompt(context: UserContext, monthStartDate: string): string {
  return [
    safetyPreamble(context),
    '',
    `Suggest a supplement regimen for the month beginning ${monthStartDate}.`,
    '',
    'About this person:',
    describeUser(context),
    '',
    'Requirements:',
    '- Suggest between 2 and 6 supplements. Fewer, well-justified ones are better',
    '  than a long stack.',
    '- Only well-studied, widely available supplements. No proprietary blends.',
    '- Express dosage as a typical range, never as an instruction to the user.',
    '- Say so when whole food would serve the same purpose better.',
    '- Do not suggest anything contraindicated by the declared health conditions.',
    '- Keep each guidance entry to two to four plain-English sentences.',
    '- Do not include a disclaimer sentence; one is added automatically.',
  ].join('\n');
}

/**
 * Guarantees the disclaimer is present exactly once.
 *
 * Applied to every item on the way into the database, so the caveat is a
 * property of the stored data rather than of the screen that happens to render
 * it — no future surface can display the advice without it.
 */
export function withDisclaimer(guidance: string): string {
  const trimmed = guidance.trim();
  if (trimmed.includes('healthcare provider')) {
    return trimmed;
  }
  const separator = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${separator}${SUPPLEMENT_DISCLAIMER}`;
}
