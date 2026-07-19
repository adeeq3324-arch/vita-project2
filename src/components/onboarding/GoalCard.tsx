import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, gradients, radius, shadows, spacing } from '@/theme';
import type { PrimaryGoal } from '@/types';

import { GOAL_PHOTO_ASPECT, goalBlendColor, goalImages, goalPhotoOffset } from './goalImages';

const CARD_HEIGHT = 148;
/** Width reserved on the right of the card for the photo. */
const FIGURE_WIDTH = 158;
/** Full-width render height of the photo before the card clips it. */
const PHOTO_HEIGHT = Math.round(FIGURE_WIDTH / GOAL_PHOTO_ASPECT);
/** Width of the fade that blends the photo's left edge into the card. */
const FADE_WIDTH = 72;

const gradientByGoal: Record<PrimaryGoal, readonly [string, string]> = {
  muscle_gain: gradients.muscleGain,
  weight_loss: gradients.weightLoss,
  healthy_lifestyle: gradients.healthyLifestyle,
};

type GoalCardProps = {
  goal: PrimaryGoal;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Full-bleed gradient goal card: radio on the left, copy beside it, figure on
 * the right. Selection is shown by the filled radio plus a white ring around
 * the card.
 */
export function GoalCard({ goal, title, description, selected, onPress }: GoalCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={gradientByGoal[goal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, selected && styles.cardSelected]}
      >
        <View style={styles.radio}>{selected ? <View style={styles.radioDot} /> : null}</View>

        <View style={styles.figure} pointerEvents="none">
          <Image
            source={goalImages[goal]}
            style={[styles.photo, { top: goalPhotoOffset[goal] }]}
            contentFit="fill"
            transition={200}
            accessible={false}
          />
          {/* Fades the photo's straight left edge into the card gradient. */}
          <LinearGradient
            colors={[goalBlendColor[goal], colors.transparent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fade}
            pointerEvents="none"
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.base,
    ...shadows.md,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  card: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.base,
    borderRadius: radius.base,
    borderWidth: 2,
    borderColor: colors.transparent,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: colors.white,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  copy: {
    flex: 1,
    marginLeft: spacing.md,
    // Keeps the copy clear of the figure, which is out of flow behind it.
    marginRight: FIGURE_WIDTH - spacing.base,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    lineHeight: 26,
    color: colors.white,
  },
  description: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    lineHeight: 19,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: spacing.xs,
  },
  figure: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: FIGURE_WIDTH,
    // Clips the taller photo to the card, revealing a head-through-torso band.
    overflow: 'hidden',
  },
  photo: {
    position: 'absolute',
    left: 0,
    // Rendered at natural aspect (so `fill` doesn't distort); `top` is set
    // per-goal inline to frame the band.
    width: FIGURE_WIDTH,
    height: PHOTO_HEIGHT,
  },
  fade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: FADE_WIDTH,
  },
});
