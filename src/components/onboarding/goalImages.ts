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
