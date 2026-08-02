/**
 * VITAL AI — AI assistant service.
 *
 * A single entry point for the AI-generated experiences that are still produced
 * on the device: planning copy and the scanner analysers. Output is personalised
 * from the user's onboarding profile.
 *
 * The production model, prompts and credentials are configured server-side
 * through the environment (`env.aiEnabled`); the client never names or calls a
 * provider directly. These local generators produce the same typed, profile-
 * aware shapes the server will return, so screens stay unchanged when the live
 * service is wired in.
 *
 * The coach is no longer among them — it talks to the real model over
 * `coachService`, and there is nothing left here for it to stand in for.
 */

export { aiRecommendation } from './plan';
export { analyzeFoodColor, analyzeFoodScan, analyzeProduct } from './scanner';

export type { FoodScanResult, FreshnessResult, ProductResult } from './types';
