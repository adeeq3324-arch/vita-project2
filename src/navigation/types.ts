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

  /**
   * Planning detail screens.
   *
   * The detail routes carry both the plan and the item, because a meal or a
   * supplement only exists inside a generated plan — the pair is what the API
   * addresses them by, and it is what lets these screens be opened directly
   * without the plan already being in memory.
   */
  MealPlan: undefined;
  MealDetail: { mealPlanId: string; mealId: string };
  /**
   * The method behind one planned meal.
   *
   * The dish's name, photograph and sitting ride along as optional params so the
   * hero is painted the instant the screen opens rather than after the recipe
   * arrives — the first request for a dish generates it, and a second of grey
   * where the photograph belongs is the difference between a screen that feels
   * instant and one that feels like it is thinking. The response carries all
   * three as well, so a deep link that has none of them still renders whole.
   */
  MealRecipe: {
    mealPlanId: string;
    mealId: string;
    mealName?: string;
    imageUrl?: string | null;
    mealType?: MealType;
  };
  SupplementPlan: undefined;
  SupplementDetail: { supplementPlanId: string; supplementId: string };

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
    // Declaration merging is the only way to extend this interface, and merging
    // requires the `interface` form — an alias would not register anything. The
    // body is empty because the whole point is to adopt `RootStackParamList`.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
