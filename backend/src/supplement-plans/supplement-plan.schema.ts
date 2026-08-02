import * as z from 'zod';
import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';

/**
 * The contract and prompt for a monthly supplement regimen.
 *
 * Supplements are the most safety-sensitive thing the platform generates: a
 * dosage read as an instruction is a real-world harm, not merely a bad
 * recommendation. The schema below is shaped around a single division — the
 * model may describe the *substance* (what is in a serving, what it does, who
 * should avoid it) but never tells the user how much of it to take. The amount
 * is the one decision routed to a person who can see the whole picture, and
 * `recommendation` says so on every item, with the disclaimer appended by code
 * rather than left to the model to remember.
 */

const BEST_TIMES = [
  'morning',
  'afternoon',
  'evening',
  'withMeal',
  'preWorkout',
  'postWorkout',
  'beforeBed',
] as const;

const TIERS = ['core', 'optional'] as const;

/**
 * The sentence every item ends with.
 *
 * Appended in code, not requested in the prompt, because a disclaimer that
 * depends on the model complying is not a disclaimer. Exported so the appending
 * logic and any test can agree on the exact wording.
 */
export const SUPPLEMENT_DISCLAIMER =
  'Do not start this supplement until you have spoken to a doctor or pharmacist ' +
  'and agreed the right amount for you — especially if you take medication, have ' +
  'a health condition, or are pregnant. This is general wellness information, ' +
  'not medical advice.';

export const supplementItemSchema = z.object({
  supplementName: z
    .string()
    .min(2)
    .max(120)
    .describe('Common name of the supplement, e.g. "Vitamin D3"'),
  tier: z
    .enum(TIERS)
    .describe(
      'core when the regimen depends on it for this person, optional when it is ' +
        'worth considering but nothing is lost by skipping it',
    ),
  category: z
    .string()
    .min(3)
    .max(60)
    .describe('What kind of supplement this is, e.g. "Protein supplement", "Mineral"'),
  headline: z
    .string()
    .min(8)
    .max(60)
    .describe('The single benefit it is being taken for, e.g. "Muscle recovery & growth"'),
  bestTime: z.enum(BEST_TIMES).describe('When in the day it is best taken'),
  servingSize: z
    .string()
    .min(3)
    .max(60)
    .describe(
      'What one serving of a standard product of this type is, as its label ' +
        'would state it, e.g. "1 capsule" or "1 scoop (30 g)"',
    ),
  ingredients: z
    .array(
      z.object({
        name: z
          .string()
          .min(2)
          .max(80)
          .describe(
            'The compound or nutrient, named as a label names it, e.g. ' +
              '"Vitamin D3 (cholecalciferol)" or "Protein"',
          ),
        amount: z
          .string()
          .min(1)
          .max(40)
          .describe('How much of it is in one serving, with its unit, e.g. "1000 IU", "25 g"'),
      }),
    )
    .min(2)
    .max(12)
    .describe(
      'The supplement facts panel for a standard product of this type: every ' +
        'active compound in a serving, plus the energy and macronutrients where ' +
        'the form has any. Typical values, not a specific brand’s.',
    ),
  purpose: z
    .string()
    .min(10)
    .max(240)
    .describe('One line on why this is suggested for this particular person'),
  benefits: z
    .array(z.string().min(6).max(80))
    .min(2)
    .max(5)
    .describe('Short, concrete, well-evidenced claims. One phrase each, no sentences.'),
  safety: z
    .array(z.string().min(10).max(140))
    .min(2)
    .max(5)
    .describe(
      'Practical cautions for this supplement: who should avoid it, what it ' +
        'interacts with, how to store it. One phrase each.',
    ),
  recommendation: z
    .string()
    .min(40)
    .max(400)
    .describe(
      'Two or three sentences telling the reader to speak to a doctor or ' +
        'pharmacist before starting this, and to ask them what amount is right ' +
        'for them. Name what specifically is worth raising for this substance — ' +
        'a blood test, a medication it interacts with, an upper limit. Never ' +
        'state a dose yourself.',
    ),
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
  'describe what is in them rather than telling anyone how much to take, and you',
  'say plainly when food is the better source. Deciding an amount is a',
  'clinician’s job and you always direct the reader to one. You never suggest',
  'anything that interacts with a declared health condition. You output data,',
  'never prose.',
].join(' ');

/**
 * Builds the generation prompt for one user's month.
 *
 * The cap on the number of items is a safety constraint rather than a formatting
 * one: a long stack is both harder to adhere to and more likely to interact, so
 * the prompt asks for the few that are actually justified. The core/optional
 * split serves the same end — it gives the model somewhere to put a merely
 * plausible suggestion other than the list the user is asked to commit to.
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
    '- Mark at most three as `core`. Everything a person actually needs is a short',
    '  list; anything you are less sure of belongs in `optional`.',
    '- Only well-studied, widely available supplements. No proprietary blends.',
    '- Never state a dose, a range, or an amount to take. That decision belongs to',
    '  a clinician who can see the whole picture, and `recommendation` is where you',
    '  send the reader to one.',
    '- `ingredients` describes what is *in* a standard product of that type — the',
    '  amounts on a facts panel, not amounts to consume. Include the energy and',
    '  macronutrients when the form has any, such as a protein powder.',
    '- Say so when whole food would serve the same purpose better.',
    '- Do not suggest anything contraindicated by the declared health conditions.',
    '- `benefits` are what it is known to do; keep them to claims the evidence',
    '  actually supports, and drop any you would have to hedge.',
    '- `safety` must be specific to that supplement — an interaction, a person who',
    '  should avoid it, a storage requirement. Never a generic "consult a doctor";',
    '  that belongs in `recommendation`.',
    '- Do not append a disclaimer sentence; one is added automatically.',
    '- Do not invent a brand, a product name, or a rating.',
  ].join('\n');
}

/**
 * Guarantees the disclaimer is present exactly once.
 *
 * Applied to every item's recommendation on the way into the database, so the
 * caveat is a property of the stored data rather than of the screen that happens
 * to render it — no future surface can show a supplement without it.
 *
 * Appended rather than substituted: the model's own sentences name what is worth
 * raising for that particular substance, which a fixed paragraph cannot, and the
 * standing wording then closes it whatever the model chose to say.
 */
export function withDisclaimer(recommendation: string): string {
  const trimmed = recommendation.trim();
  if (trimmed.includes(SUPPLEMENT_DISCLAIMER)) {
    return trimmed;
  }
  const separator = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${separator}${SUPPLEMENT_DISCLAIMER}`;
}
