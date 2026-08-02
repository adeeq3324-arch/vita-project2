import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing, typography } from '@/theme';

const USE_NATIVE = Platform.OS !== 'web';

type CameraViewfinderProps = {
  hint: string;
  /** `frame` draws corner brackets; `barcode` draws a scan window with a moving line. */
  variant?: 'frame' | 'barcode';
  onCapture: () => void;
};

/**
 * Camera-style capture screen shared by the scanners: a dark viewfinder with a
 * framing guide, hint, and capture / gallery / flip controls.
 *
 * The live preview is stubbed with a dark gradient — device camera capture is
 * wired in with the native build; the flow, framing and capture handoff here
 * are final.
 */
export function CameraViewfinder({ hint, variant = 'frame', onCapture }: CameraViewfinderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  // Read during render (the scan line binds to it), so it is state, not a ref.
  const [scan] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (variant !== 'barcode') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1400, useNativeDriver: USE_NATIVE }),
        Animated.timing(scan, { toValue: 0, duration: 1400, useNativeDriver: USE_NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan, variant]);

  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, 120] });

  return (
    <LinearGradient colors={['#1F2937', '#0B1120']} style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close camera"
          style={styles.iconBtn}
          hitSlop={spacing.sm}
        >
          <Feather name="x" size={24} color={colors.white} />
        </Pressable>
        <Pressable accessibilityLabel="Toggle flash" style={styles.iconBtn} hitSlop={spacing.sm}>
          <Feather name="zap" size={22} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.center}>
        {variant === 'barcode' ? (
          <View style={styles.barcodeWindow}>
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
          </View>
        ) : (
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        )}
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable accessibilityLabel="Choose from gallery" style={styles.sideBtn}>
          <Feather name="image" size={22} color={colors.white} />
        </Pressable>

        <Pressable
          onPress={onCapture}
          accessibilityRole="button"
          accessibilityLabel="Capture"
          style={({ pressed }) => [styles.shutterRing, pressed && styles.shutterPressed]}
        >
          <View style={styles.shutter} />
        </Pressable>

        <Pressable accessibilityLabel="Flip camera" style={styles.sideBtn}>
          <Feather name="refresh-cw" size={22} color={colors.white} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const CORNER = 34;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 260,
    height: 260,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.white,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  barcodeWindow: {
    width: 260,
    height: 130,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  scanLine: {
    height: 2,
    backgroundColor: colors.danger,
    marginTop: 4,
  },
  hint: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutter: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});
