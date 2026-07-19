import { useId } from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { colors } from '@/theme';

/**
 * VITAL AI mark: a heart drawn as a single rounded gradient stroke (violet →
 * blue) with an orange accent dot, over faint concentric rings.
 */
export function VitalLogo({ size = 132 }: { size?: number }) {
  // Unique per instance: on web the SVG becomes real DOM, and a shared gradient
  // id collides with other mounted instances, blanking the fill.
  const gradientId = `heartStroke-${useId().replace(/:/g, '')}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityRole="image">
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A855F7" />
          <Stop offset="0.5" stopColor="#7C3AED" />
          <Stop offset="1" stopColor="#2563EB" />
        </SvgLinearGradient>
      </Defs>

      {/* Faint rings echoing the design's background texture. */}
      <Circle cx="60" cy="58" r="52" stroke={colors.divider} strokeWidth={1} fill="none" />
      <Circle cx="60" cy="58" r="40" stroke={colors.divider} strokeWidth={1} fill="none" />

      <Path
        d="M60 100
           C 30 78, 14 60, 14 42
           C 14 26, 26 16, 40 16
           C 49 16, 56 21, 60 30
           C 64 21, 71 16, 80 16
           C 94 16, 106 26, 106 42
           C 106 60, 90 78, 60 100 Z"
        stroke={`url(#${gradientId})`}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <Circle cx="78" cy="88" r="7" fill={colors.accent.orange} />
    </Svg>
  );
}
