import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { MainStackParamList } from '@/navigation/types';

/**
 * The four FAB quick actions. Single source of truth for the radial menu and
 * the placeholder screens, so their icons, labels and routes stay in sync.
 */
export type QuickActionRoute = keyof Pick<
  MainStackParamList,
  'FoodScanner' | 'FoodTracking' | 'ColorAnalysis' | 'BarcodeScanner'
>;

export type QuickAction = {
  route: QuickActionRoute;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Accent driving the menu bubble's colour. */
  accent: 'violet' | 'orange' | 'cyan';
  subtitle: string;
};

export const quickActions: QuickAction[] = [
  {
    route: 'FoodScanner',
    label: 'Food Scanner',
    icon: 'camera',
    accent: 'violet',
    subtitle: 'Point your camera at a meal to log it instantly.',
  },
  {
    route: 'FoodTracking',
    label: 'Food Tracking',
    icon: 'silverware-fork-knife',
    accent: 'orange',
    subtitle: 'Search foods and build your daily diary.',
  },
  {
    route: 'ColorAnalysis',
    label: 'Color Analysis',
    icon: 'water-opacity',
    accent: 'cyan',
    subtitle: 'Check food freshness and quality from a photo.',
  },
  {
    route: 'BarcodeScanner',
    label: 'Barcode Scanner',
    icon: 'barcode-scan',
    accent: 'violet',
    subtitle: 'Scan a product barcode for instant nutrition facts.',
  },
];
