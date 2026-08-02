import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { MainStackParamList } from '@/navigation/types';

/**
 * The four FAB quick actions. Single source of truth for the radial menu, so
 * their icons, labels and destinations stay in sync.
 *
 * Three push a screen; water opens a sheet over whatever the user is looking at.
 * Water earns its slot because it is the only metric logged many times a day —
 * sending someone to a screen and back six times would be the wrong shape for it.
 */
export type QuickActionRoute = keyof Pick<
  MainStackParamList,
  'FoodScanner' | 'FoodTracking' | 'BarcodeScanner'
>;

/** Actions handled in place rather than by navigating. */
export type QuickActionSheet = 'water';

export type QuickAction = {
  /** Stable identity for lists and callbacks. */
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Accent driving the menu bubble's colour. */
  accent: 'violet' | 'orange' | 'cyan';
  subtitle: string;
} & ({ route: QuickActionRoute; sheet?: never } | { sheet: QuickActionSheet; route?: never });

export const quickActions: QuickAction[] = [
  {
    key: 'food-scanner',
    route: 'FoodScanner',
    label: 'Food Scanner',
    icon: 'camera',
    accent: 'violet',
    subtitle: 'Point your camera at a meal to log it instantly.',
  },
  {
    key: 'food-tracking',
    route: 'FoodTracking',
    label: 'Food Tracking',
    icon: 'silverware-fork-knife',
    accent: 'orange',
    subtitle: 'Search foods and build your daily diary.',
  },
  {
    key: 'water',
    sheet: 'water',
    label: 'Log Water',
    icon: 'cup-water',
    accent: 'cyan',
    subtitle: 'Add a glass and keep your hydration on target.',
  },
  {
    key: 'barcode-scanner',
    route: 'BarcodeScanner',
    label: 'Barcode Scanner',
    icon: 'barcode-scan',
    accent: 'violet',
    subtitle: 'Scan a product barcode for instant nutrition facts.',
  },
];
