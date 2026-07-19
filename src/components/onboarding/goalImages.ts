import type { ImageSourcePropType } from 'react-native';

import type { PrimaryGoal } from '@/types';

/**
 * Goal-card photography, keyed by goal. Each shot is on a background that
 * matches its card's gradient so the image blends into the card seamlessly.
 */
export const goalImages: Record<PrimaryGoal, ImageSourcePropType> = {
  muscle_gain: require('../../../assets/images/goals/muscle-gain.jpg'),
  weight_loss: require('../../../assets/images/goals/weight-loss.jpg'),
  healthy_lifestyle: require('../../../assets/images/goals/healthy-lifestyle.jpg'),
};

/**
 * Colour the photo's left edge fades into, per goal. Chosen to match each
 * photo's background so the seam against the card gradient disappears.
 */
export const goalBlendColor: Record<PrimaryGoal, string> = {
  muscle_gain: '#5B21B6',
  weight_loss: '#F2701A',
  healthy_lifestyle: '#22A2E2',
};

/**
 * All three portraits share this source aspect ratio (591 × 1280). The card
 * clips a head-through-torso band from a full-width render of each.
 */
export const GOAL_PHOTO_ASPECT = 591 / 1280;

/**
 * Vertical offset (px) applied to each full-height photo render inside the
 * card's clip window. The portraits carry different amounts of headroom, so
 * each is nudged so the frame reads head-through-torso — not just the face —
 * matching the design. Tuned against rendered output.
 *
 * Done with absolute offset + `overflow: hidden` rather than expo-image's
 * `contentPosition`, which renders inconsistently between web and native.
 */
export const goalPhotoOffset: Record<PrimaryGoal, number> = {
  muscle_gain: -34,
  weight_loss: -26,
  healthy_lifestyle: -70,
};
