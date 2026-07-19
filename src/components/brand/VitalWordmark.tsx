import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { fontFamily, fontSize, fontWeight } from '@/theme';

const WIDTH = 232;
const HEIGHT = 58;

/**
 * The "Vital AI" wordmark, filled with the brand's violet → blue gradient.
 *
 * Drawn as SVG text rather than a gradient masked over a `<Text>`: a mask
 * needs `@react-native-masked-view`, which silently drops the gradient on web
 * and leaves the wordmark flat black. An SVG gradient fill renders the same on
 * iOS, Android and web.
 */
export function VitalWordmark() {
  // Unique per instance so multiple mounted wordmarks don't share a DOM
  // gradient id on web (which blanks the fill).
  const gradientId = `wordmarkFill-${useId().replace(/:/g, '')}`;

  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Vital AI">
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#8B5CF6" />
            <Stop offset="1" stopColor="#2563EB" />
          </SvgLinearGradient>
        </Defs>
        <SvgText
          x={WIDTH / 2}
          // Baseline at ~78% of the box leaves room for descenders.
          y={HEIGHT * 0.78}
          textAnchor="middle"
          fontFamily={fontFamily.bold}
          fontSize={fontSize['5xl']}
          fontWeight={fontWeight.bold}
          fill={`url(#${gradientId})`}
        >
          Vital AI
        </SvgText>
      </Svg>
    </View>
  );
}
