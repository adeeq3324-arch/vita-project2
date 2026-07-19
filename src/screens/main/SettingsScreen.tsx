import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors, spacing } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { reset } = useOnboarding();
  const [notifications, setNotifications] = useState(true);

  const logOut = () => {
    reset();
    // Return to the onboarding flow at the root.
    navigation.getParent()?.navigate('Onboarding');
  };

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card padding="none" style={styles.card}>
          <ListRow
            icon="bell-outline"
            label="Notifications"
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                thumbColor={colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <ListRow icon="white-balance-sunny" label="Theme" value="Light" onPress={() => {}} />
          <View style={styles.divider} />
          <ListRow icon="translate" label="Language" value="English" onPress={() => {}} />
          <View style={styles.divider} />
          <ListRow icon="shield-check-outline" label="Privacy & Security" onPress={() => {}} />
          <View style={styles.divider} />
          <ListRow icon="ruler" label="Units" value="Metric" onPress={() => {}} />
        </Card>

        <Card padding="none" style={styles.card}>
          <ListRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
          <View style={styles.divider} />
          <ListRow icon="information-outline" label="About Vital AI" value="v1.0.0" onPress={() => {}} />
        </Card>

        <Card padding="none" style={styles.card}>
          <ListRow icon="logout" label="Log Out" danger onPress={logOut} hideChevron />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  card: {
    paddingHorizontal: spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
