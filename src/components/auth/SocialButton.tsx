import { FontAwesome } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { GoogleGlyph } from '@/components/brand/GoogleGlyph';
import { colors, layout, radius, shadows, typography } from '@/theme';

export type SocialProvider = 'google' | 'apple' | 'facebook';

/**
 * Official third-party brand treatments. These hex values are fixed by each
 * provider's brand guidelines, so they live here rather than in the app's
 * design-system palette.
 */
const providers: Record<
  SocialProvider,
  { label: string; background: string; foreground: string; border?: string }
> = {
  google: {
    label: 'Continue with Google',
    background: colors.white,
    foreground: colors.text.primary,
    border: colors.border,
  },
  apple: {
    label: 'Continue with Apple',
    background: colors.black,
    foreground: colors.white,
  },
  facebook: {
    label: 'Continue with Facebook',
    background: '#1877F2',
    foreground: colors.white,
  },
};

const ICON_SIZE = 20;

function ProviderIcon({ provider, color }: { provider: SocialProvider; color: string }) {
  if (provider === 'google') return <GoogleGlyph size={ICON_SIZE} />;
  return (
    <FontAwesome
      name={provider === 'apple' ? 'apple' : 'facebook'}
      size={provider === 'apple' ? ICON_SIZE + 2 : ICON_SIZE}
      color={color}
    />
  );
}

type SocialButtonProps = {
  provider: SocialProvider;
  onPress: () => void;
  style?: ViewStyle;
};

/**
 * Full-width "Continue with …" button in a provider's brand style. Icon leads,
 * label is centred. UI only — the press handler wires to real auth later.
 */
export function SocialButton({ provider, onPress, style }: SocialButtonProps) {
  const config = providers[provider];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={config.label}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: config.background },
        config.border ? { borderWidth: layout.hairline, borderColor: config.border } : null,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.icon}>
        <ProviderIcon provider={provider} color={config.foreground} />
      </View>
      <Text style={[styles.label, { color: config.foreground }]}>{config.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.ctaHeight,
    borderRadius: radius.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    ...shadows.xs,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  // Fixed-width leading slot so every label starts at the same x across buttons.
  icon: {
    width: ICON_SIZE + 4,
    alignItems: 'center',
    marginRight: 12,
  },
  label: {
    ...typography.button,
  },
});
