import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';

import { colors, radius, shadows, typography } from '@/theme';
import { quickActions, type QuickAction } from '@/screens/main/quickActions';

/** Native transform driver isn't supported on web; fall back to the JS driver. */
const USE_NATIVE = Platform.OS !== 'web';

/** Radius of the radial menu — distance from centre to each bubble. */
const RADIUS = 96;
const BUBBLE = 62;
const ITEM_WIDTH = 104;

const accentColor = {
  violet: colors.primary,
  orange: colors.accent.orange,
  cyan: colors.accent.cyan,
} as const;

/** Final offset from the cross centre, in draw order (top, left, right, bottom). */
const offsets = [
  { dx: 0, dy: -RADIUS },
  { dx: -RADIUS, dy: 0 },
  { dx: RADIUS, dy: 0 },
  { dx: 0, dy: RADIUS },
];

type FabMenuProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: QuickAction) => void;
};

/**
 * Full-screen quick-action menu that springs out of the FAB into a cross of
 * four actions, joined by dashed guides, with a close button where the FAB sits.
 */
export function FabMenu({ visible, onClose, onSelect }: FabMenuProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Read during render (every bubble binds to it), so it is state, not a ref.
  const [anim] = useState(() => new Animated.Value(0));
  // The menu outlives `visible` by one animation: it stays mounted while the
  // bubbles collapse back into the FAB. `exiting` is that tail and nothing more
  // — being *open* is already fully described by `visible`.
  //
  // The tail has to begin in the same commit that `visible` goes false, or the
  // menu unmounts before it can animate away. React's tool for that is
  // adjusting state during render: it re-renders immediately, without painting
  // the intermediate result. An effect cannot do this — it runs after paint, so
  // the menu would blink out first and only then start collapsing.
  const [exiting, setExiting] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    setExiting(!visible);
  }

  const mounted = visible || exiting;

  useEffect(() => {
    if (visible) {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE,
        friction: 7,
        tension: 80,
      }).start();
      return;
    }

    // Nothing on screen to animate away: either the first render, or the
    // collapse already finished.
    if (!exiting) return;

    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: USE_NATIVE,
    }).start(({ finished }) => finished && setExiting(false));
  }, [anim, exiting, visible]);

  if (!mounted) return null;

  const centerX = width / 2;
  const centerY = height * 0.44;
  const crossSize = RADIUS * 2;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />

        {/* Dashed cross joining the four bubbles. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cross,
            { left: centerX - RADIUS, top: centerY - RADIUS, opacity: anim },
          ]}
        >
          <Svg width={crossSize} height={crossSize}>
            <Line x1={RADIUS} y1={0} x2={RADIUS} y2={crossSize} stroke={colors.primaryLight} strokeWidth={1.5} strokeDasharray="3 5" />
            <Line x1={0} y1={RADIUS} x2={crossSize} y2={RADIUS} stroke={colors.primaryLight} strokeWidth={1.5} strokeDasharray="3 5" />
            <Circle cx={RADIUS} cy={RADIUS} r={3} fill={colors.primaryLight} />
          </Svg>
        </Animated.View>

        {quickActions.map((action, index) => {
          const { dx, dy } = offsets[index]!;
          const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] });
          const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-dy, 0] });
          const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

          return (
            <Animated.View
              key={action.key}
              style={[
                styles.item,
                {
                  left: centerX + dx - ITEM_WIDTH / 2,
                  top: centerY + dy - BUBBLE / 2,
                  opacity: anim,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
            >
              <Pressable
                onPress={() => onSelect(action)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.bubble,
                  { backgroundColor: accentColor[action.accent] },
                  pressed && styles.bubblePressed,
                ]}
              >
                <MaterialCommunityIcons name={action.icon} size={26} color={colors.white} />
              </Pressable>
              <Text style={styles.label} numberOfLines={1}>
                {action.label}
              </Text>
            </Animated.View>
          );
        })}

        {/* Close button, positioned where the FAB sits. */}
        <Animated.View
          style={[
            styles.closeWrap,
            { bottom: insets.bottom + 4, left: centerX - 28, opacity: anim },
          ]}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <Feather name="x" size={26} color={colors.white} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  cross: {
    position: 'absolute',
  },
  item: {
    position: 'absolute',
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  bubblePressed: {
    transform: [{ scale: 0.92 }],
  },
  label: {
    ...typography.label,
    color: colors.text.primary,
    marginTop: 8,
    textAlign: 'center',
  },
  closeWrap: {
    position: 'absolute',
  },
  close: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  closePressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.94 }],
  },
});
