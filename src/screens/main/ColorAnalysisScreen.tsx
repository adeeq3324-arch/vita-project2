import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraViewfinder } from '@/components/scanner/CameraViewfinder';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'ColorAnalysis'>;

/** Color/freshness analysis camera: capture hands off to the freshness result. */
export function ColorAnalysisScreen({ navigation }: Props) {
  return (
    <CameraViewfinder
      hint="Center food in the frame"
      variant="frame"
      onCapture={() => navigation.replace('ColorAnalysisResult')}
    />
  );
}
