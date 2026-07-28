import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { BarcodeResultScreen } from '@/screens/main/BarcodeResultScreen';
import { BarcodeScannerScreen } from '@/screens/main/BarcodeScannerScreen';
import { ColorAnalysisResultScreen } from '@/screens/main/ColorAnalysisResultScreen';
import { ColorAnalysisScreen } from '@/screens/main/ColorAnalysisScreen';
import { FoodScanResultScreen } from '@/screens/main/FoodScanResultScreen';
import { FoodScannerScreen } from '@/screens/main/FoodScannerScreen';
import { FoodTrackingScreen } from '@/screens/main/FoodTrackingScreen';
import { MealDetailScreen } from '@/screens/main/MealDetailScreen';
import { MealPlanScreen } from '@/screens/main/MealPlanScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { ChangeGoalScreen } from '@/screens/main/profile/ChangeGoalScreen';
import { EditHealthConditionsScreen } from '@/screens/main/profile/EditHealthConditionsScreen';
import { EditProfileScreen } from '@/screens/main/profile/EditProfileScreen';
import { RemindersScreen } from '@/screens/main/RemindersScreen';
import { SettingsScreen } from '@/screens/main/SettingsScreen';
import { SupplementDetailScreen } from '@/screens/main/SupplementDetailScreen';
import { SupplementPlanScreen } from '@/screens/main/SupplementPlanScreen';
import { useOnboarding, type OnboardingData } from '@/context/OnboardingContext';
import { isAuthenticated, profileService } from '@/services';
import { colors } from '@/theme';

import { MainTabNavigator } from './MainTabNavigator';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Hydrates the in-memory onboarding/profile state from the backend when the
 * user enters the app. The main screens render from the onboarding store, but
 * that store is empty for a returning user (and reset after sign-up), so
 * without this their persisted profile would show blank until they re-enter it.
 * Best-effort: on any failure we keep whatever is already in memory.
 */
function useProfileHydration(): void {
  const { update } = useOnboarding();

  useEffect(() => {
    if (!isAuthenticated()) return;
    let active = true;

    void (async () => {
      try {
        const overview = await profileService.getOverview();
        if (!active) return;

        const patch: Partial<OnboardingData> = { conditions: overview.conditions };
        if (overview.profile) {
          patch.username = overview.profile.username;
          patch.age = String(overview.profile.age);
          patch.gender = overview.profile.gender;
          patch.height = String(overview.profile.height);
          patch.weight = String(overview.profile.weight);
          patch.activityLevel = overview.profile.activityLevel;
        }
        if (overview.goal) {
          patch.goal = overview.goal.primaryGoal;
          if (overview.goal.targetWeight !== null) {
            patch.targetWeight = String(overview.goal.targetWeight);
          }
        }
        update(patch);
      } catch {
        // Non-fatal: fall back to the current in-memory state.
      }
    })();

    return () => {
      active = false;
    };
  }, [update]);
}

/**
 * Wraps the tab navigator so Profile, the planning details and the scanner
 * flows can be pushed over the tabs. Camera screens present modally (bottom-up)
 * to read as a distinct capture mode.
 */
export function MainNavigator() {
  useProfileHydration();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabNavigator} />

      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangeGoal" component={ChangeGoalScreen} />
      <Stack.Screen name="EditHealthConditions" component={EditHealthConditionsScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />

      <Stack.Screen name="MealPlan" component={MealPlanScreen} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} />
      <Stack.Screen name="SupplementPlan" component={SupplementPlanScreen} />
      <Stack.Screen name="SupplementDetail" component={SupplementDetailScreen} />

      <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
        <Stack.Screen name="FoodScanner" component={FoodScannerScreen} />
        <Stack.Screen name="ColorAnalysis" component={ColorAnalysisScreen} />
        <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
      </Stack.Group>

      <Stack.Screen name="FoodScanResult" component={FoodScanResultScreen} />
      <Stack.Screen name="FoodTracking" component={FoodTrackingScreen} />
      <Stack.Screen name="ColorAnalysisResult" component={ColorAnalysisResultScreen} />
      <Stack.Screen name="BarcodeResult" component={BarcodeResultScreen} />
    </Stack.Navigator>
  );
}
