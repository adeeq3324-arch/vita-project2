import {
  calculateBmr,
  calculateTdee,
  deriveTargets,
  fingerprintInputs,
  type TargetInputs,
} from './nutrition.calculator';

/**
 * A reference adult used across the suite: 30-year-old male, 180 cm, 80 kg,
 * moderately active, maintaining. Individual tests override only the field
 * under examination, so a failure points at one variable rather than at a
 * wholesale change of subject.
 */
const baseInputs: TargetInputs = {
  age: 30,
  gender: 'male',
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderately_active',
  primaryGoal: 'healthy_lifestyle',
  targetWeightKg: null,
};

const withInputs = (overrides: Partial<TargetInputs>): TargetInputs => ({
  ...baseInputs,
  ...overrides,
});

describe('calculateBmr', () => {
  // Mifflin-St Jeor: (10 × 80) + (6.25 × 180) − (5 × 30) + 5 = 1780
  it('matches the published Mifflin-St Jeor result for men', () => {
    expect(calculateBmr(baseInputs)).toBe(1780);
  });

  // Same body, female sex term: 1775 − 161 = 1614
  it('applies the female sex term', () => {
    expect(calculateBmr(withInputs({ gender: 'female' }))).toBe(1614);
  });

  it.each(['other', 'prefer_not_to_say'] as const)(
    'uses the midpoint sex term for %s, sitting between the two',
    (gender) => {
      const neutral = calculateBmr(withInputs({ gender }));

      expect(neutral).toBe(1697);
      expect(neutral).toBeLessThan(calculateBmr(withInputs({ gender: 'male' })));
      expect(neutral).toBeGreaterThan(calculateBmr(withInputs({ gender: 'female' })));
    },
  );
});

describe('calculateTdee', () => {
  it.each([
    ['sedentary', 2136],
    ['lightly_active', 2447.5],
    ['moderately_active', 2759],
    ['very_active', 3070.5],
    ['extremely_active', 3382],
  ] as const)('scales BMR by the %s factor', (activityLevel, expected) => {
    expect(calculateTdee(1780, activityLevel)).toBe(expected);
  });

  it('orders the activity factors so more activity never yields less energy', () => {
    const levels = [
      'sedentary',
      'lightly_active',
      'moderately_active',
      'very_active',
      'extremely_active',
    ] as const;

    const values = levels.map((level) => calculateTdee(1780, level));
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('deriveTargets', () => {
  it('maintains at TDEE when the goal is a healthy lifestyle', () => {
    const targets = deriveTargets(baseInputs);
    expect(targets.calories).toBe(2759);
  });

  it('applies a 20% deficit for weight loss and a 15% surplus for muscle gain', () => {
    const loss = deriveTargets(withInputs({ primaryGoal: 'weight_loss' }));
    const gain = deriveTargets(withInputs({ primaryGoal: 'muscle_gain' }));

    expect(loss.calories).toBe(Math.round(2759 * 0.8));
    expect(gain.calories).toBe(Math.round(2759 * 1.15));
  });

  /**
   * The floors exist so an aggressive deficit on a small, sedentary body cannot
   * produce a target below what a diet can meet micronutrient needs on. This is
   * the case that would actually harm someone, so it is asserted directly rather
   * than inferred from the percentages.
   */
  it.each([
    ['female', 1200],
    ['male', 1500],
    ['other', 1350],
  ] as const)('never drops %s below the %d kcal floor', (gender, floor) => {
    const targets = deriveTargets(
      withInputs({
        gender,
        primaryGoal: 'weight_loss',
        weightKg: 40,
        heightCm: 145,
        age: 70,
        activityLevel: 'sedentary',
      }),
    );

    expect(targets.calories).toBe(floor);
  });

  it('scales protein with body weight and goal', () => {
    expect(deriveTargets(withInputs({ primaryGoal: 'muscle_gain' })).proteinG).toBe(160);
    expect(deriveTargets(withInputs({ primaryGoal: 'weight_loss' })).proteinG).toBe(144);
    expect(deriveTargets(withInputs({ primaryGoal: 'healthy_lifestyle' })).proteinG).toBe(128);
  });

  /**
   * The macro split is only correct if the three add back up to the calorie
   * target — carbohydrate is derived as the remainder precisely so they do.
   * Rounding each gram to a whole number allows a little drift, so the assertion
   * allows one gram's worth in each direction rather than demanding exactness it
   * cannot have.
   */
  it.each(['weight_loss', 'muscle_gain', 'healthy_lifestyle'] as const)(
    'allocates macros that sum back to the calorie target (%s)',
    (primaryGoal) => {
      const targets = deriveTargets(withInputs({ primaryGoal }));
      const fromMacros = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9;

      expect(Math.abs(fromMacros - targets.calories)).toBeLessThanOrEqual(9);
    },
  );

  it('never returns negative carbohydrate when protein alone approaches the floor', () => {
    // A heavy, short, sedentary, elderly body on an aggressive deficit: the
    // protein target is large while the calorie target is at its floor.
    const targets = deriveTargets(
      withInputs({
        gender: 'female',
        primaryGoal: 'weight_loss',
        weightKg: 150,
        heightCm: 150,
        age: 75,
        activityLevel: 'sedentary',
      }),
    );

    expect(targets.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('derives fibre from calories and rounds water to the nearest 100 ml', () => {
    const targets = deriveTargets(baseInputs);

    expect(targets.fiberG).toBe(Math.round((targets.calories / 1000) * 14));
    // 80 kg × 35 ml + 250 ml activity bonus = 3050 → 3100 (nearest 100)
    expect(targets.waterMl).toBe(3100);
    expect(targets.waterMl % 100).toBe(0);
  });

  it('adds a fluid allowance as activity rises', () => {
    const sedentary = deriveTargets(withInputs({ activityLevel: 'sedentary' }));
    const extreme = deriveTargets(withInputs({ activityLevel: 'extremely_active' }));

    expect(extreme.waterMl - sedentary.waterMl).toBe(800);
  });

  it('spreads intake over more sittings for muscle gain', () => {
    expect(deriveTargets(withInputs({ primaryGoal: 'muscle_gain' })).mealsPerDay).toBe(5);
    expect(deriveTargets(withInputs({ primaryGoal: 'weight_loss' })).mealsPerDay).toBe(4);
  });
});

describe('fingerprintInputs', () => {
  it('is stable for identical inputs', () => {
    expect(fingerprintInputs(baseInputs)).toBe(fingerprintInputs({ ...baseInputs }));
  });

  /**
   * The fingerprint decides whether stored targets are still valid, so any input
   * that changes the result must change the hash. A field missed here would show
   * up as targets that silently never refresh after a profile edit.
   */
  it.each([
    ['age', { age: 31 }],
    ['gender', { gender: 'female' as const }],
    ['heightCm', { heightCm: 181 }],
    ['weightKg', { weightKg: 81 }],
    ['activityLevel', { activityLevel: 'very_active' as const }],
    ['primaryGoal', { primaryGoal: 'weight_loss' as const }],
    ['targetWeightKg', { targetWeightKg: 75 }],
  ])('changes when %s changes', (_field, override) => {
    expect(fingerprintInputs(withInputs(override))).not.toBe(fingerprintInputs(baseInputs));
  });

  it('does not collide between a null target weight and an empty-ish one', () => {
    expect(fingerprintInputs(withInputs({ targetWeightKg: null }))).not.toBe(
      fingerprintInputs(withInputs({ targetWeightKg: 0 })),
    );
  });
});
