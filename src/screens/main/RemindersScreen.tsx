import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateView';
import { useFocusRefresh, useResource } from '@/hooks';
import {
  CATEGORY_LABELS,
  REMINDER_CATEGORIES,
  create,
  list,
  parseTimeInput,
  remove,
  update,
  type Reminder,
  type ReminderCategory,
  type ReminderFilter,
} from '@/services/reminders/remindersService';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import { accentName, materialIcon } from '@/utils/icons';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
] as const;

export function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<ReminderFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const reminders = useResource(() => list(filter), [filter]);
  useFocusRefresh(reminders.refresh);

  const items = reminders.data ?? [];

  /**
   * The switch writes through to the server and re-reads. It deliberately does
   * not update local state first: a reminder that looks on but is off on the
   * server is the one failure mode this screen must never have.
   */
  const toggle = async (reminder: Reminder) => {
    setPendingId(reminder.id);
    try {
      await update(reminder.id, { enabled: !reminder.enabled });
      await reminders.refresh();
    } catch (error) {
      Alert.alert(
        'Could not update that reminder',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setPendingId(null);
    }
  };

  const confirmDelete = (reminder: Reminder) => {
    Alert.alert('Delete reminder', `Delete “${reminder.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await remove(reminder.id);
              await reminders.refresh();
            } catch (error) {
              Alert.alert(
                'Could not delete that reminder',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          })();
        },
      },
    ]);
  };

  const onCreated = useCallback(() => {
    setModalOpen(false);
    void reminders.refresh();
  }, [reminders]);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Reminders" />
      <View style={styles.filterWrap}>
        <Segmented options={filters} value={filter} onChange={setFilter} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {reminders.loading ? <LoadingState label="Loading reminders…" /> : null}

        {reminders.error && !reminders.data ? (
          <ErrorState message={reminders.error.message} onRetry={reminders.refresh} />
        ) : null}

        {reminders.data && items.length === 0 ? (
          <EmptyState
            icon="bell"
            title={filter === 'all' ? 'No reminders yet' : 'Nothing in this view'}
            message={
              filter === 'all'
                ? 'Add one and VITAL AI will nudge you at the right time — supplements, water, workouts.'
                : 'Switch to All to see every reminder you have set.'
            }
            action={filter === 'all' ? 'Add reminder' : undefined}
            onAction={filter === 'all' ? () => setModalOpen(true) : undefined}
          />
        ) : null}

        {items.length > 0 ? (
          <Card padding="none" style={styles.listCard}>
            {items.map((reminder, index) => (
              <View key={reminder.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  onLongPress={() => confirmDelete(reminder)}
                  accessibilityRole="button"
                  accessibilityLabel={`${reminder.name} at ${reminder.timeLabel}. Long press to delete.`}
                  style={styles.row}
                >
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: colors.accentSurface[accentName(reminder.accent)] },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={materialIcon(reminder.icon, 'bell-ring')}
                      size={18}
                      color={colors.accent[accentName(reminder.accent)]}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.time}>
                      {reminder.timeLabel} · {reminder.repeat}
                    </Text>
                    <Text style={styles.name}>{reminder.name}</Text>
                  </View>
                  {pendingId === reminder.id ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => void toggle(reminder)}
                      trackColor={{ true: colors.primary, false: colors.borderStrong }}
                      thumbColor={colors.white}
                    />
                  )}
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Pressable
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>Add Reminder</Text>
        </Pressable>
      </ScrollView>

      <AddReminderSheet
        visible={modalOpen}
        bottomInset={insets.bottom}
        onClose={() => setModalOpen(false)}
        onCreated={onCreated}
      />
    </Screen>
  );
}

/** Bottom sheet for creating a reminder: name, time, and what kind it is. */
function AddReminderSheet({
  visible,
  bottomInset,
  onClose,
  onCreated,
}: {
  visible: boolean;
  bottomInset: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<ReminderCategory>('custom');
  const [saving, setSaving] = useState(false);

  const parsedTime = parseTimeInput(time);
  const timeInvalid = time.trim().length > 0 && parsedTime === null;
  const valid = name.trim().length > 0 && parsedTime !== null;

  const reset = () => {
    setName('');
    setTime('');
    setCategory('custom');
  };

  const save = async () => {
    if (!valid || parsedTime === null) return;
    setSaving(true);
    try {
      await create({ name: name.trim(), time: parsedTime, category });
      reset();
      onCreated();
    } catch (error) {
      Alert.alert(
        'Could not save that reminder',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: bottomInset + spacing.base }]}>
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
          placeholder="e.g. 7:30 PM or 19:30"
          placeholderTextColor={colors.text.disabled}
          autoCapitalize="none"
          style={[styles.input, timeInvalid && styles.inputInvalid]}
        />
        {timeInvalid ? (
          <Text style={styles.inputError}>Enter a time like 7:30 PM or 19:30.</Text>
        ) : null}

        <Text style={styles.fieldLabel}>Kind</Text>
        <View style={styles.chips}>
          {REMINDER_CATEGORIES.map((value) => {
            const selected = value === category;
            return (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {CATEGORY_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => void save()}
          disabled={!valid || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            (!valid || saving) && styles.saveDisabled,
            pressed && styles.savePressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveText}>Save Reminder</Text>
          )}
        </Pressable>
      </View>
    </Modal>
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
  inputInvalid: {
    borderColor: colors.danger,
    marginBottom: spacing.xs,
  },
  inputError: {
    ...typography.micro,
    color: colors.danger,
    marginBottom: spacing.base,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.white,
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
