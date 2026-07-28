import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, gradients, radius, shadows, spacing } from '@/theme';
import type { PrimaryGoal } from '@/types';

import { goalImages } from './goalImages';

const CARD_HEIGHT = 148;
/**
 * Width of the photo column on the right. The portraits are tall (591×1280),
 * so a `cover` fit is width-driven at this box: a narrower box means a smaller
 * scale, which reveals more of the body vertically (head → shoulders → chest)
 * rather than zooming into the face. At ~100px the figure reads as head-and-
 * chest and occupies ~30–35% of the card width on a typical phone. Because the
 * fit is width-driven, the full image width is shown, so the left/right edges
 * are the photo's own gradient margins and blend into the card seamlessly —
 * only the waist is cropped, bleeding off the bottom like the reference design.
 */
const FIGURE_WIDTH = 100;
/** Gutter between the photo and the card's right edge. */
const FIGURE_RIGHT_PADDING = 16;

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
          {/*
           * Anchored to the top so the crop starts at the head and runs down
           * through the shoulders and chest; the waist falls past the card's
           * bottom edge and bleeds off. `cover` is width-driven in this narrow
           * box, so no side of the body is cut — the person's upper body reads
           * clearly and the photo's gradient margins blend into the card.
           */}
          <Image
            source={goalImages[goal]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={200}
            accessible={false}
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
    marginRight: FIGURE_WIDTH + FIGURE_RIGHT_PADDING,
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
    right: FIGURE_RIGHT_PADDING,
    top: 0,
    bottom: 0,
    width: FIGURE_WIDTH,
    // Clips the portrait to the card's rounded corners.
    overflow: 'hidden',
  },
});
