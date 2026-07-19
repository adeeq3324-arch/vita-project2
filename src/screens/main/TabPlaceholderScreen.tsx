import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing, typography } from '@/theme';

type TabPlaceholderScreenProps = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * Titled placeholder for tabs whose content lands in later tasks. Shows the
 * tab's name so navigation reads correctly, with a "coming soon" note.
 */
export function TabPlaceholderScreen({ title, icon }: TabPlaceholderScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon} size={30} color={colors.primary} />
        </View>
        <Text style={styles.soon}>Coming soon</Text>
        <Text style={styles.hint}>{title} lands in an upcoming update.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: layout.tabBarHeight,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  soon: {
    ...typography.h3,
    color: colors.text.primary,
  },
  hint: {
    ...typography.body,
    color: colors.text.tertiary,
  },
});
