import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, type AccentName, type MetricName } from '@/theme';

/**
 * Resolves the presentation hints the API sends as plain strings.
 *
 * The backend deliberately sends design-system *keys* — an icon glyph name, an
 * accent key — rather than colour values, so the palette stays owned by the app.
 * That contract is only safe if the client tolerates a key it does not know:
 * a server deployed with a newer catalogue entry should degrade to a neutral
 * tile, never crash the screen it appears on.
 */

export type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const DEFAULT_ICON: MaterialIconName = 'circle-outline';

export function materialIcon(
  name: string | undefined,
  fallback: MaterialIconName = DEFAULT_ICON,
): MaterialIconName {
  return name && name in MaterialCommunityIcons.glyphMap ? (name as MaterialIconName) : fallback;
}

export function accentName(name: string | undefined): AccentName {
  return name && name in colors.accent ? (name as AccentName) : 'neutral';
}

export function metricName(name: string | undefined): MetricName {
  return name && name in colors.metric ? (name as MetricName) : 'calories';
}
