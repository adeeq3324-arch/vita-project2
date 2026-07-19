import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { FabButton } from './FabButton';
import { FabMenu } from './FabMenu';

type IonName = keyof typeof Ionicons.glyphMap;

/** Per-tab presentation: label and its active / inactive icon. */
const tabs: Record<
  Exclude<keyof MainTabParamList, 'Action'>,
  { label: string; icon: IonName; iconActive: IonName }
> = {
  Home: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  Progress: { label: 'Progress', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  AiCoach: { label: 'AI Coach', icon: 'person-outline', iconActive: 'person' },
  Planning: { label: 'Planning', icon: 'calendar-outline', iconActive: 'calendar' },
};

/**
 * Custom bottom tab bar: two tab pairs flanking a central floating action
 * button. The `Action` route carries no screen of its own — its slot renders
 * the FAB, which opens the quick-action menu rather than navigating.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  // Quick actions are pushed on the parent stack (they aren't tabs).
  const rootNav = navigation.getParent<NativeStackNavigationProp<MainStackParamList>>();

  return (
    <View style={[styles.bar, { height: layout.tabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}>
      <FabMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={(route) => {
          setMenuOpen(false);
          rootNav?.navigate(route);
        }}
      />

      {state.routes.map((route, index) => {
        if (route.name === 'Action') {
          return (
            <View key={route.key} style={styles.fabSlot}>
              <FabButton onPress={() => setMenuOpen(true)} />
            </View>
          );
        }

        const config = tabs[route.name as keyof typeof tabs];
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.text.tertiary;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={config.label}
            style={styles.tab}
          >
            <Ionicons name={focused ? config.iconActive : config.icon} size={23} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
    ...shadows.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    ...typography.micro,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    // Lifts the FAB so it straddles the top edge of the bar, per the design.
    marginTop: -layout.fabLift,
  },
});
