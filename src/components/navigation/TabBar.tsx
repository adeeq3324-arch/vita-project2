import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { FabButton } from './FabButton';
import { FabMenu } from './FabMenu';

type IonName = keyof typeof Ionicons.glyphMap;

/** Horizontal gap between the highlight pill and its slot edges. */
const PILL_INSET_X = spacing.sm;

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
  const [barWidth, setBarWidth] = useState(0);

  // Quick actions are pushed on the parent stack (they aren't tabs).
  const rootNav = navigation.getParent<NativeStackNavigationProp<MainStackParamList>>();

  // One equal slot per route (tabs + the FAB slot). The highlight pill slides
  // across these slots to sit behind the active tab.
  const slotCount = state.routes.length;
  const slotWidth = barWidth / slotCount;
  const pillWidth = Math.max(slotWidth - PILL_INSET_X * 2, 0);

  // `progress` tracks the focused slot index; animating it slides the pill.
  const progress = useSharedValue(state.index);
  useEffect(() => {
    progress.value = withTiming(state.index, { duration: 220 });
  }, [progress, state.index]);

  const pillStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: progress.value * slotWidth + PILL_INSET_X }],
    }),
    [slotWidth],
  );

  return (
    <View
      style={[styles.bar, { height: layout.tabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: pillWidth }, pillStyle]}
        />
      )}

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
  // Highlight that sits behind the active tab and slides between slots.
  pill: {
    position: 'absolute',
    left: 0,
    top: spacing.xs,
    height: layout.tabBarHeight - spacing.sm * 2,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
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
