/**
 * VITAL AI — Color palette.
 *
 * Derived from the supplied design system. The app is light-theme only:
 * white surfaces, a violet primary, and a set of saturated accents used to
 * colour-code the health domains (nutrition, water, workout, supplements).
 */

/** Raw palette. Screens should not import this — use `colors` below. */
const palette = {
  violet900: '#3B0F9E',
  violet700: '#5B21B6',
  violet600: '#6D28D9',
  violet500: '#7C3AED',
  violet400: '#8B5CF6',
  violet200: '#C4B5FD',
  violet100: '#EDE9FE',
  violet50: '#F5F3FF',

  orange600: '#EA580C',
  orange500: '#F97316',
  orange100: '#FFEDD5',

  cyan600: '#0284C7',
  cyan500: '#0EA5E9',
  cyan100: '#E0F2FE',

  green600: '#16A34A',
  green500: '#22C55E',
  green100: '#DCFCE7',

  red600: '#DC2626',
  red500: '#EF4444',
  red100: '#FEE2E2',

  pink500: '#EC4899',
  pink100: '#FCE7F3',

  amber500: '#F59E0B',
  amber100: '#FEF3C7',

  /**
   * Planning design tokens. The plan screens are colour-coded by domain rather
   * than by the app's violet: a warm amber for food, a cool blue for
   * supplements. Kept as their own stops because they are specified values from
   * the planning design, not tints of the accents above.
   */
  plannerAmber: '#DC8E47',
  plannerAmberDark: '#B8712F',
  plannerAmberSurface: '#FBF0E5',
  plannerBlue: '#3AC9FA',
  plannerBlueDark: '#1AA7DA',
  plannerBlueSurface: '#E6F7FE',
  plannerInk: '#1A0D0A',

  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',

  black: '#000000',
  transparent: 'transparent',
} as const;

export const colors = {
  /** Primary violet — CTAs, active tab, FAB, selected states. */
  primary: palette.violet600,
  primaryDark: palette.violet700,
  primaryLight: palette.violet400,
  /** Tinted violet surface — soft chips, AI insight cards, disabled CTAs. */
  primarySurface: palette.violet100,
  primarySubtle: palette.violet50,
  onPrimary: palette.white,

  /** Screen background. */
  background: palette.white,
  /** Raised surfaces: cards, inputs, sheets. */
  surface: palette.white,
  /** Recessed surface: search fields, inactive segmented control. */
  surfaceMuted: palette.gray50,
  surfaceSunken: palette.gray100,

  border: palette.gray200,
  borderStrong: palette.gray300,
  divider: palette.gray100,

  text: {
    /** Headings and primary values. */
    primary: palette.gray900,
    /** Body copy. */
    secondary: palette.gray600,
    /** Labels, captions, units. */
    tertiary: palette.gray500,
    /** Placeholders and disabled copy. */
    disabled: palette.gray400,
    /** Copy on violet / coloured fills. */
    inverse: palette.white,
  },

  /** Semantic feedback. */
  success: palette.green500,
  successSurface: palette.green100,
  warning: palette.amber500,
  warningSurface: palette.amber100,
  danger: palette.red500,
  dangerSurface: palette.red100,
  info: palette.cyan500,
  infoSurface: palette.cyan100,

  /**
   * Health-domain accents. The design colour-codes each tracked metric
   * consistently across Home, Progress and Planning.
   */
  metric: {
    calories: palette.orange500,
    protein: palette.violet500,
    carbs: palette.amber500,
    fat: palette.red500,
    fiber: palette.green500,
    water: palette.cyan500,
    steps: palette.green500,
    workout: palette.violet500,
    supplements: palette.cyan500,
    meals: palette.red500,
    reminders: palette.orange500,
  },

  /** Soft tinted backgrounds paired with `metric`, for icon tiles. */
  metricSurface: {
    calories: palette.orange100,
    protein: palette.violet100,
    carbs: palette.amber100,
    fat: palette.red100,
    fiber: palette.green100,
    water: palette.cyan100,
    steps: palette.green100,
    workout: palette.violet100,
    supplements: palette.cyan100,
    meals: palette.red100,
    reminders: palette.orange100,
  },

  /**
   * Decorative accents used to colour-code icon tiles (onboarding feature
   * rows, health-condition tiles). Pair each with its `accentSurface` tint.
   */
  accent: {
    violet: palette.violet500,
    orange: palette.orange500,
    cyan: palette.cyan500,
    green: palette.green500,
    pink: palette.pink500,
    red: palette.red500,
    neutral: palette.gray500,
  },

  accentSurface: {
    violet: palette.violet100,
    orange: palette.orange100,
    cyan: palette.cyan100,
    green: palette.green100,
    pink: palette.pink100,
    red: palette.red100,
    neutral: palette.gray100,
  },

  /**
   * The Planning surface's own accents.
   *
   * Meal planning is warm and supplement planning is cool, and the split is
   * doing real work: the two plans have near-identical layouts, and the colour
   * is what tells a user at a glance which one they are looking at. `ink` is the
   * near-black the planning design sets its headings in — deeper and warmer than
   * the app's neutral gray, so plan headings read as their own surface.
   */
  plan: {
    meal: palette.plannerAmber,
    mealDark: palette.plannerAmberDark,
    mealSurface: palette.plannerAmberSurface,
    supplement: palette.plannerBlue,
    supplementDark: palette.plannerBlueDark,
    supplementSurface: palette.plannerBlueSurface,
    ink: palette.plannerInk,
  },

  /** Scrim behind modals and the FAB action menu. */
  overlay: 'rgba(17, 24, 39, 0.6)',
  /** Camera viewfinder dimming. */
  scrim: 'rgba(0, 0, 0, 0.45)',

  white: palette.white,
  black: palette.black,
  transparent: palette.transparent,
} as const;

/**
 * Gradients from the design. Each is an ordered stop list for
 * `expo-linear-gradient`'s `colors` prop.
 */
export const gradients = {
  /** Brand mark and primary CTA wash. */
  brand: [palette.violet500, palette.violet700],
  /** Muscle Gain goal card. */
  muscleGain: [palette.violet500, palette.violet900],
  /** Weight Loss goal card, Meal Plan card. */
  weightLoss: [palette.orange500, palette.orange600],
  /** Healthy Lifestyle goal card, Supplement Plan card. */
  healthyLifestyle: [palette.cyan500, palette.cyan600],
  /** Health-score arc, low → high. */
  healthScore: [palette.red500, palette.amber500, palette.green500],
} as const;

export type ColorTheme = typeof colors;
export type GradientName = keyof typeof gradients;
export type MetricName = keyof typeof colors.metric;
export type AccentName = keyof typeof colors.accent;
