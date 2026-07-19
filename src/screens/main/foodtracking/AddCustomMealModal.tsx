import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { MealDraft } from '@/context/FoodDiaryContext';

/** Bottom sheet for logging a custom meal by name and calories. */
export function AddCustomMealModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: MealDraft) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');

  const reset = () => {
    setName('');
    setKcal('');
  };

  const save = () => {
    const calories = parseInt(kcal, 10);
    if (!name.trim() || !Number.isFinite(calories) || calories <= 0) return;
    // Estimate a balanced macro split from the calorie total.
    onSave({
      name: name.trim(),
      kcal: calories,
      protein: Math.round((calories * 0.3) / 4),
      carbs: Math.round((calories * 0.45) / 4),
      fat: Math.round((calories * 0.25) / 9),
      icon: 'silverware-fork-knife',
      accent: 'violet',
    });
    reset();
  };

  const valid = name.trim().length > 0 && parseInt(kcal, 10) > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Add Custom Meal</Text>

        <Text style={styles.label}>Meal name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Chicken Wrap"
          placeholderTextColor={colors.text.disabled}
          style={styles.input}
        />

        <Text style={styles.label}>Calories</Text>
        <TextInput
          value={kcal}
          onChangeText={(v) => setKcal(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 450"
          placeholderTextColor={colors.text.disabled}
          keyboardType="number-pad"
          style={styles.input}
        />

        <Pressable
          onPress={save}
          disabled={!valid}
          accessibilityRole="button"
          style={({ pressed }) => [styles.save, !valid && styles.saveDisabled, pressed && valid && styles.savePressed]}
        >
          <Text style={[styles.saveText, !valid && styles.saveTextDisabled]}>Save Meal</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.base,
  },
  label: {
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
  save: {
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
  saveTextDisabled: {
    color: colors.primaryLight,
  },
});
