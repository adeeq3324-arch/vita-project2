import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/theme';

import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigator.
 *
 * Starts in Onboarding and hands off to Main (the tabbed app) once the flow
 * completes. Once auth lands, the initial route is chosen from session and
 * onboarding-completion state rather than hardcoded.
 */
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      <Stack.Screen name="Main" component={MainNavigator} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}
