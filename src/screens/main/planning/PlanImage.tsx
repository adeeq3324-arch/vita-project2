import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

type PlanImageProps = {
  /** Photograph to show. Null whenever none has been attached to the item. */
  uri: string | null;
  /** Drawn in the tinted tile when there is no photograph to show. */
  icon: Glyph;
  /** Tile fill and glyph colour, so the tile reads as part of its surface. */
  tint: { surface: string; color: string };
  iconSize?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/**
 * The photograph slot on a plan card or detail hero.
 *
 * Plan items carry an optional image: the generator names dishes and
 * supplements, it does not photograph them, so whether a picture exists depends
 * on what the image pipeline has filled in. Rather than leave a grey rectangle
 * where one is missing, the same slot renders a tinted tile carrying the item's
 * own glyph — the layout is identical either way, so a plan with no photographs
 * still looks finished rather than broken.
 *
 * A URL that fails to load falls back to exactly the same tile, which is what
 * makes an expired or unreachable image a cosmetic difference rather than a hole
 * in the screen.
 */
export function PlanImage({
  uri,
  icon,
  tint,
  iconSize = 28,
  style,
  accessibilityLabel,
}: PlanImageProps) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={[styles.base, { backgroundColor: tint.surface }, style]}
        accessible={accessibilityLabel !== undefined}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <MaterialCommunityIcons name={icon} size={iconSize} color={tint.color} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      // The tile and the photograph occupy exactly the same box, so callers pass
      // one style for both. Flattened and narrowed here because the two element
      // types disagree on `overflow` alone, and every value actually passed is
      // valid for an image.
      style={
        StyleSheet.flatten([styles.base, { backgroundColor: tint.surface }, style]) as ImageStyle
      }
      contentFit="cover"
      transition={180}
      onError={() => setFailed(true)}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
});
