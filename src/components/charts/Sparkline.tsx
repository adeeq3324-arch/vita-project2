import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Fill the area under the line with a soft gradient. */
  fill?: boolean;
};

/**
 * Compact trend line for the Health Score card. Plots `data` across the width,
 * with an optional soft area fill and a dot on the latest point.
 */
export function Sparkline({
  data,
  width = 132,
  height = 44,
  color = colors.primary,
  fill = true,
}: SparklineProps) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`;
  const pad = 4;

  if (data.length < 2) return <Svg width={width} height={height} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const points = data.map((value, index) => {
    const x = pad + (index / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return { x, y };
  });

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${last.x} ${height} L ${first.x} ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {fill ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
      <Path d={line} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke={colors.surface} strokeWidth={1.5} />
    </Svg>
  );
}
