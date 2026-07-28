import * as z from 'zod';
import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';

/**
 * Contracts and prompts for the three scanners.
 *
 * All of them answer the same underlying question — "what is this, and is it
 * good for *me*" — so they share a nutrition core and differ only in what else
 * they are asked to look for. Keeping the schemas side by side is what keeps
 * that consistency visible.
 */

/** Nutrition every scanner estimates, for a single realistic serving. */
const nutritionShape = {
  foodName: z.string().min(2).max(120).describe('What the item is, in plain words'),
  calories: z.number().min(0).max(5000).describe('kcal for one realistic serving'),
  protein: z.number().min(0).max(500).describe('grams'),
  carbs: z.number().min(0).max(1000).describe('grams'),
  fat: z.number().min(0).max(500).describe('grams'),
  healthScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('How well this fits this specific person, 0 = poor, 100 = excellent'),
  aiInsight: z
    .string()
    .min(20)
    .max(600)
    .describe('Two or three sentences addressed to the user, explaining the score'),
};

export const foodScanSchema = z.object(nutritionShape);

export const qualityScanSchema = z.object({
  ...nutritionShape,
  freshnessScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Visual freshness, 0 = spoiled, 100 = peak condition'),
});

export const productLookupSchema = z.object({
  brand: z.string().min(1).max(120).describe('Manufacturer or brand name'),
  name: z.string().min(2).max(160).describe('Product name as printed on the packaging'),
  ingredients: z
    .array(z.string().min(1).max(120))
    .max(60)
    .describe('Ingredient list, most significant first. Empty if genuinely unknown.'),
  rating: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Nutritional quality of the product itself, independent of any person'),
  alternatives: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        reason: z.string().min(10).max(240).describe('One line on why it is a better choice'),
      }),
    )
    .max(4)
    .describe('Healthier substitutes, or an empty array if none is warranted'),
  ...{
    calories: nutritionShape.calories,
    protein: nutritionShape.protein,
    carbs: nutritionShape.carbs,
    fat: nutritionShape.fat,
  },
});

export type FoodScanAnalysis = z.infer<typeof foodScanSchema>;
export type QualityScanAnalysis = z.infer<typeof qualityScanSchema>;
export type ProductLookup = z.infer<typeof productLookupSchema>;

export const SCANNER_SYSTEM_PROMPT = [
  'You are a nutrition analyst for a health and fitness platform. You estimate',
  'conservatively, you say what you can actually see rather than what a dish',
  'usually contains, and you never invent detail to sound confident.',
  'You output data, never prose.',
].join(' ');

/**
 * Prompt for the food-photograph scanner.
 *
 * The instruction to score against *this* user rather than in the abstract is
 * the entire point of the feature: a bowl of rice is not good or bad on its own,
 * only relative to somebody's goal, targets and conditions.
 */
export function buildFoodScanPrompt(context: UserContext): string {
  return [
    safetyPreamble(context),
    '',
    'Identify the food in this photograph and estimate its nutrition for one',
    'realistic serving of what is actually shown.',
    '',
    'Score it for this person specifically:',
    describeUser(context),
    '',
    'Requirements:',
    '- Estimate from what is visible. Do not assume hidden ingredients.',
    '- healthScore judges the fit with this person\'s goal, targets and',
    '  conditions — not the food in the abstract.',
    '- aiInsight speaks to the user directly, says why the score is what it is,',
    '  and gives one practical suggestion.',
    '- If the photograph does not show food, say so in foodName and score it 0.',
  ].join('\n');
}

/**
 * Prompt for the colour-quality scanner.
 *
 * Freshness and nutrition are asked for together because the user is holding one
 * item and expects one answer about it — splitting them into two calls would
 * double the latency and the cost of a single scan.
 */
export function buildQualityScanPrompt(context: UserContext): string {
  return [
    safetyPreamble(context),
    '',
    'Assess the freshness and quality of the food in this photograph from its',
    'colour, texture and any visible blemishes, bruising, wilting or mould.',
    '',
    'Also estimate its nutrition and score its fit for this person:',
    describeUser(context),
    '',
    'Requirements:',
    '- freshnessScore reflects what the image shows: colour, firmness, spotting,',
    '  browning, mould. Be conservative when the image is unclear.',
    '- aiInsight explains the freshness judgement first, then whether it is still',
    '  good to eat and how soon it should be used.',
    '- If the photograph does not show food, say so in foodName and score both 0.',
  ].join('\n');
}

/**
 * Prompt for resolving an unknown barcode.
 *
 * The honesty instruction matters more here than anywhere else: a fabricated
 * ingredient list for a real product is stored in a shared cache and served to
 * every future user who scans that code, so a confident guess would not be one
 * bad answer but a permanent one.
 */
export function buildProductLookupPrompt(barcode: string): string {
  return [
    `Identify the packaged product with barcode ${barcode}.`,
    '',
    'Requirements:',
    '- Report only what you actually know about this product. If you do not',
    '  recognise the barcode, say so by returning "Unknown" for brand and name',
    '  and an empty ingredients array — do not invent a plausible product.',
    '- rating judges the product\'s nutritional quality on its own terms,',
    '  independent of any particular person.',
    '- Nutrition figures are per serving as declared on the packaging.',
    '- Suggest up to four genuinely healthier alternatives in the same category,',
    '  or none at all if the product is already a good choice.',
  ].join('\n');
}

/** True when a lookup came back as an honest "I do not know this code". */
export function isUnknownProduct(product: ProductLookup): boolean {
  return /^unknown$/i.test(product.brand.trim()) && /^unknown$/i.test(product.name.trim());
}

/**
 * Prompt for the personalised half of a barcode scan.
 *
 * Deliberately a second, separate call against the cached product. The product
 * facts are the same for everyone and are stored once; the verdict on whether
 * *this* user should eat it is not cacheable and is generated fresh each time.
 */
export function buildProductInsightPrompt(
  context: UserContext,
  product: { brand: string; name: string; ingredients: string[]; rating: number },
): string {
  const ingredients =
    product.ingredients.length > 0 ? product.ingredients.join(', ') : 'not available';

  return [
    safetyPreamble(context),
    '',
    `This person scanned "${product.brand} ${product.name}".`,
    `Ingredients: ${ingredients}`,
    `General nutritional quality: ${product.rating}/100`,
    '',
    'About them:',
    describeUser(context),
    '',
    'In two or three sentences, tell them directly whether this fits their goals',
    'and conditions, and what to watch for. Be specific about this product rather',
    'than giving generic advice. Plain text only — no markdown, no headings.',
  ].join('\n');
}
