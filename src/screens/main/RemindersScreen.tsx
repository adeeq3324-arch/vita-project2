import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { AccentName } from '@/theme';
import type { AIIcon } from '@/services/ai/types';

type Reminder = {
  id: string;
  time: string;
  name: string;
  icon: AIIcon;
  accent: AccentName;
  on: boolean;
  when: 'today' | 'upcoming';
};

const initial: Reminder[] = [
  { id: 'r1', time: '8:00 AM', name: 'Take Vitamin D3', icon: 'weather-sunny', accent: 'orange', on: true, when: 'today' },
  { id: 'r2', time: '12:00 PM', name: 'Lunch Reminder', icon: 'silverware-fork-knife', accent: 'red', on: true, when: 'today' },
  { id: 'r3', time: '4:00 PM', name: 'Workout Time', icon: 'dumbbell', accent: 'green', on: true, when: 'today' },
  { id: 'r4', time: '6:00 PM', name: 'Drink Water', icon: 'cup-water', accent: 'cyan', on: true, when: 'today' },
  { id: 'r5', time: '9:00 PM', name: 'Magnesium', icon: 'moon-waning-crescent', accent: 'violet', on: false, when: 'upcoming' },
];

const filters = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
] as const;

export function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState(initial);
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');

  const visible = useMemo(
    () => (filter === 'all' ? reminders : reminders.filter((r) => r.when === filter)),
    [reminders, filter],
  );

  const toggle = (id: string) =>
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));

  const addReminder = () => {
    if (!name.trim() || !time.trim()) return;
    setReminders((prev) => [
      ...prev,
      { id: `r-${Date.now()}`, time: time.trim(), name: name.trim(), icon: 'bell-ring', accent: 'violet', on: true, when: 'today' },
    ]);
    setName('');
    setTime('');
    setModalOpen(false);
  };

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Reminders" />
      <View style={styles.filterWrap}>
        <Segmented options={filters} value={filter} onChange={setFilter} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card padding="none" style={styles.listCard}>
          {visible.map((reminder, index) => (
            <View key={reminder.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: colors.accentSurface[reminder.accent] }]}>
                  <MaterialCommunityIcons name={reminder.icon} size={18} color={colors.accent[reminder.accent]} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.time}>{reminder.time}</Text>
                  <Text style={styles.name}>{reminder.name}</Text>
                </View>
                <Switch
                  value={reminder.on}
                  onValueChange={() => toggle(reminder.id)}
                  trackColor={{ true: colors.primary, false: colors.borderStrong }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
          ))}
        </Card>

        <Pressable
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>Add Reminder</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Add Reminder</Text>
          <Text style={styles.fieldLabel}>Reminder name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Evening walk"
            placeholderTextColor={colors.text.disabled}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Time</Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="e.g. 7:30 PM"
            placeholderTextColor={colors.text.disabled}
            style={styles.input}
          />
          <Pressable
            onPress={addReminder}
            disabled={!name.trim() || !time.trim()}
            style={({ pressed }) => [
              styles.saveBtn,
              (!name.trim() || !time.trim()) && styles.saveDisabled,
              pressed && styles.savePressed,
            ]}
          >
            <Text style={styles.saveText}>Save Reminder</Text>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterWrap: {
    marginBottom: spacing.md,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  listCard: {
    paddingHorizontal: spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  time: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.base,
    backgroundColor: colors.primary,
  },
  addBtnPressed: {
    backgroundColor: colors.primaryDark,
  },
  addBtnText: {
    ...typography.button,
    color: colors.white,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    ...shadows.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.base,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.base,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    height: layout.inputHeight,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.base,
  },
  saveBtn: {
    height: layout.ctaHeight,
    borderRadius: radius.base,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  saveDisabled: {
    backgroundColor: colors.primarySurface,
  },
  savePressed: {
    backgroundColor: colors.primaryDark,
  },
  saveText: {
    ...typography.button,
    color: colors.white,
  },
});
