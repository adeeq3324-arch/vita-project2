import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthScreen } from '@/screens/onboarding/AuthScreen';
import { EmailLoginScreen } from '@/screens/onboarding/EmailLoginScreen';
import { EmailSignUpScreen } from '@/screens/onboarding/EmailSignUpScreen';
import { ForgotPasswordScreen } from '@/screens/onboarding/ForgotPasswordScreen';
import { GoalSelectionScreen } from '@/screens/onboarding/GoalSelectionScreen';
import { HealthConditionsScreen } from '@/screens/onboarding/HealthConditionsScreen';
import { UserInformationScreen } from '@/screens/onboarding/UserInformationScreen';
import { WelcomeScreen } from '@/screens/onboarding/WelcomeScreen';
import { colors } from '@/theme';

import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * The four-step onboarding flow. Screens carry their own back chevron, so the
 * stack header stays hidden and transitions use the platform's native
 * horizontal push.
 */
export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 280,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="GoalSelection" component={GoalSelectionScreen} />
      <Stack.Screen name="HealthConditions" component={HealthConditionsScreen} />
      <Stack.Screen name="UserInformation" component={UserInformationScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="EmailSignUp" component={EmailSignUpScreen} />
      <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
