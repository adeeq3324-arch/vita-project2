import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';
import { AICoachScreen } from '@/screens/main/AICoachScreen';
import { HomeScreen } from '@/screens/main/HomeScreen';
import { PlanningScreen } from '@/screens/main/PlanningScreen';
import { ProgressScreen } from '@/screens/main/ProgressScreen';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Empty component for the centre FAB slot — the tab bar renders the FAB, so
 *  this route never displays a screen. */
function ActionPlaceholder() {
  return <View />;
}

/**
 * The four main tabs (Home, Progress, AI Coach, Planning) with a central FAB.
 * Presentation lives in the custom `TabBar`; `Action` is the FAB's slot.
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Action" component={ActionPlaceholder} />
      <Tab.Screen name="AiCoach" component={AICoachScreen} />
      <Tab.Screen name="Planning" component={PlanningScreen} />
    </Tab.Navigator>
  );
}
