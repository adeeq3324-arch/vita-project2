import 'react-native-gesture-handler';

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FoodDiaryProvider } from '@/context/FoodDiaryContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { PlanProvider } from '@/context/PlanContext';
import { RootNavigator } from '@/navigation';
import { initAuth, loadSession } from '@/services';
import { navigationTheme } from '@/theme';

// Bind the API client to the session store and restore any persisted session
// before the first render, so authenticated requests work from the start.
initAuth();
void loadSession();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OnboardingProvider>
          <FoodDiaryProvider>
            <PlanProvider>
              <NavigationContainer theme={navigationTheme}>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            </PlanProvider>
          </FoodDiaryProvider>
        </OnboardingProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
