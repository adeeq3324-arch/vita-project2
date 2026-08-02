import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

const USE_NATIVE = Platform.OS !== 'web';
const BAR_COUNT = 28;

/**
 * Audio-style waveform for the AI Coach voice panel. When `active`, each bar
 * pulses on its own loop to simulate live listening; when idle, the bars rest
 * low and still.
 */
export function Waveform({ active, color = colors.primary }: { active: boolean; color?: string }) {
  // One animated value per bar, created once. Lazy `useState` rather than a ref:
  // these values are read while rendering (the bars bind to them), which is
  // exactly what a ref is not for.
  const [bars] = useState(() =>
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2)),
  );

  useEffect(() => {
    if (!active) {
      bars.forEach((bar) => {
        Animated.timing(bar, { toValue: 0.2, duration: 200, useNativeDriver: USE_NATIVE }).stop?.();
        Animated.timing(bar, { toValue: 0.2, duration: 200, useNativeDriver: USE_NATIVE }).start();
      });
      return;
    }

    const loops = bars.map((bar, index) => {
      const peak = 0.5 + Math.random() * 0.5;
      const duration = 320 + (index % 6) * 70;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: peak, duration, useNativeDriver: USE_NATIVE }),
          Animated.timing(bar, { toValue: 0.25, duration, useNativeDriver: USE_NATIVE }),
        ]),
      );
    });
    loops.forEach((loop, i) => setTimeout(() => loop.start(), i * 20));
    return () => loops.forEach((loop) => loop.stop());
  }, [active, bars]);

  return (
    <View style={styles.row}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              opacity: active ? 1 : 0.35,
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 3,
  },
  bar: {
    width: 3,
    height: 40,
    borderRadius: radius.full,
  },
});
