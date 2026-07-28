import type { NavigatorScreenParams } from '@react-navigation/native';

import type { MealType } from '@/types';

/**
 * VITAL AI — Route contracts.
 *
 * Declared up front so screens added later are type-safe from the first
 * commit. Only `RootStackParamList` has registered screens today; the auth,
 * onboarding and tab lists are the agreed shape for the navigators that come
 * with those features.
 */

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  GoalSelection: undefined;
  HealthConditions: undefined;
  UserInformation: undefined;
  Auth: undefined;
  /** Email + password sign-up, reached from the "Continue with Email" button. */
  EmailSignUp: undefined;
  /** Email + password login for returning users, reached from "Log in". */
  EmailLogin: undefined;
  /** Password-reset request flow, reached from the sign-up screen. */
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Progress: undefined;
  /** Placeholder route for the centre FAB; it opens the action menu rather than navigating. */
  Action: undefined;
  AiCoach: undefined;
  Planning: undefined;
};

/**
 * Stack wrapping the tab navigator, so Profile can be pushed over the tabs
 * from a screen header (Profile is not itself a tab).
 */
export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;

  /** Profile and its sub-screens (reached from the header, not tabs). */
  Profile: undefined;
  EditProfile: undefined;
  ChangeGoal: undefined;
  EditHealthConditions: undefined;
  Reminders: undefined;
  Settings: undefined;

  /** Planning detail screens. */
  MealPlan: undefined;
  MealDetail: { day: number; type: MealType };
  SupplementPlan: undefined;
  SupplementDetail: { id: string };

  /** FAB quick-action flows. */
  FoodScanner: undefined;
  FoodScanResult: undefined;
  FoodTracking: undefined;
  ColorAnalysis: undefined;
  ColorAnalysisResult: undefined;
  BarcodeScanner: undefined;
  BarcodeResult: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

/**
 * Registers the root param list globally, so `useNavigation()` is typed
 * without an explicit generic at every call site.
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
