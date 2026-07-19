import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraViewfinder } from '@/components/scanner/CameraViewfinder';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'BarcodeScanner'>;

/** Barcode camera: scanning hands off to the product details. */
export function BarcodeScannerScreen({ navigation }: Props) {
  return (
    <CameraViewfinder
      hint="Align the barcode within the frame"
      variant="barcode"
      onCapture={() => navigation.replace('BarcodeResult')}
    />
  );
}
