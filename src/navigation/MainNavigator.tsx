import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BarcodeResultScreen } from '@/screens/main/BarcodeResultScreen';
import { BarcodeScannerScreen } from '@/screens/main/BarcodeScannerScreen';
import { ColorAnalysisResultScreen } from '@/screens/main/ColorAnalysisResultScreen';
import { ColorAnalysisScreen } from '@/screens/main/ColorAnalysisScreen';
import { FoodScanResultScreen } from '@/screens/main/FoodScanResultScreen';
import { FoodScannerScreen } from '@/screens/main/FoodScannerScreen';
import { FoodTrackingScreen } from '@/screens/main/FoodTrackingScreen';
import { MealPlanScreen } from '@/screens/main/MealPlanScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { RemindersScreen } from '@/screens/main/RemindersScreen';
import { SettingsScreen } from '@/screens/main/SettingsScreen';
import { SupplementDetailScreen } from '@/screens/main/SupplementDetailScreen';
import { SupplementPlanScreen } from '@/screens/main/SupplementPlanScreen';
import { colors } from '@/theme';

import { MainTabNavigator } from './MainTabNavigator';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Wraps the tab navigator so Profile, the planning details and the scanner
 * flows can be pushed over the tabs. Camera screens present modally (bottom-up)
 * to read as a distinct capture mode.
 */
export function MainNavigator() {
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
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />

      <Stack.Screen name="MealPlan" component={MealPlanScreen} />
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
