import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraViewfinder } from '@/components/scanner/CameraViewfinder';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'FoodScanner'>;

/** Food Scanner camera: capture hands off to the scan-result analysis. */
export function FoodScannerScreen({ navigation }: Props) {
  return (
    <CameraViewfinder
      hint="Center food in the frame"
      variant="frame"
      onCapture={() => navigation.replace('FoodScanResult')}
    />
  );
}
