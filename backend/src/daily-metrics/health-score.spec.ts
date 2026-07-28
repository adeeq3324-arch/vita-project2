import { calculateHealthScore, healthScoreCaption, type HealthScoreInputs } from './health-score';

/** A day on which the user hit every target exactly. */
const perfectDay: HealthScoreInputs = {
  intake: { kcal: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30 },
  mealCount: 4,
  waterMl: 3000,
  steps: 10000,
  stepsTarget: 10000,
  workoutCompleted: true,
  targets: { calories: 2000, protein: 150, waterMl: 3000, mealsPerDay: 4 },
};

const withDay = (overrides: Partial<HealthScoreInputs>): HealthScoreInputs => ({
  ...perfectDay,
  ...overrides,
});

describe('calculateHealthScore', () => {
  it('awards 100 when every target is met', () => {
    const { score, components } = calculateHealthScore(perfectDay);

    expect(score).toBe(100);
    expect(components).toEqual({
      calories: 100,
      protein: 100,
      water: 100,
      steps: 100,
      workout: 100,
      logging: 100,
    });
  });

  it('awards 0 when nothing was logged or done', () => {
    const { score } = calculateHealthScore(
      withDay({
        intake: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        mealCount: 0,
        waterMl: 0,
        steps: 0,
        workoutCompleted: false,
      }),
    );

    expect(score).toBe(0);
  });

  /**
   * The distinguishing rule of the model: calories are scored on *closeness*,
   * so eating double the target is penalised exactly as hard as eating nothing.
   * Every other component is attainment, where more is simply full marks.
   */
  it('penalises overshooting calories as much as undershooting', () => {
    const under = calculateHealthScore(
      withDay({ intake: { ...perfectDay.intake, kcal: 1600 } }),
    );
    const over = calculateHealthScore(
      withDay({ intake: { ...perfectDay.intake, kcal: 2400 } }),
    );

    // Both are 20% away from the target, so both lose half the component.
    expect(under.components.calories).toBe(50);
    expect(over.components.calories).toBe(50);
    expect(under.score).toBe(over.score);
  });

  it('zeroes the calorie component beyond the ±40% tolerance', () => {
    const wayOver = calculateHealthScore(
      withDay({ intake: { ...perfectDay.intake, kcal: 4000 } }),
    );
    expect(wayOver.components.calories).toBe(0);
  });

  it('gives full marks for exceeding an attainment target', () => {
    const overAchieved = calculateHealthScore(
      withDay({ waterMl: 6000, steps: 25_000, intake: { ...perfectDay.intake, protein: 300 } }),
    );

    expect(overAchieved.components.water).toBe(100);
    expect(overAchieved.components.steps).toBe(100);
    expect(overAchieved.components.protein).toBe(100);
    expect(overAchieved.score).toBe(100);
  });

  it('scores attainment components linearly', () => {
    const half = calculateHealthScore(withDay({ waterMl: 1500 }));
    expect(half.components.water).toBe(50);
  });

  /**
   * A zero target means nothing was asked of the user, so nothing can be missed.
   * The alternative is a division by zero that would surface as NaN on the Home
   * card for any user whose targets have not been derived yet.
   */
  it('treats an absent target as satisfied rather than dividing by zero', () => {
    const { score, components } = calculateHealthScore(
      withDay({
        steps: 0,
        stepsTarget: 0,
        waterMl: 0,
        intake: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        mealCount: 0,
        targets: { calories: 0, protein: 0, waterMl: 0, mealsPerDay: 0 },
      }),
    );

    expect(Number.isNaN(score)).toBe(false);
    expect(components.calories).toBe(100);
    expect(components.water).toBe(100);
    expect(components.steps).toBe(100);
  });

  it('weights the workout at 10 points, all or nothing', () => {
    const withoutWorkout = calculateHealthScore(withDay({ workoutCompleted: false }));

    expect(withoutWorkout.score).toBe(90);
    expect(withoutWorkout.components.workout).toBe(0);
  });

  it('keeps the score within 0–100 for any input', () => {
    const extremes = [
      withDay({ intake: { ...perfectDay.intake, kcal: 100_000 } }),
      withDay({ steps: -5000 }),
      withDay({ waterMl: -1 }),
      withDay({ mealCount: 99 }),
    ];

    for (const day of extremes) {
      const { score } = calculateHealthScore(day);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe('healthScoreCaption', () => {
  it.each([
    [100, 'Excellent'],
    [90, 'Excellent'],
    [89, 'Great'],
    [78, 'Great'],
    [77, 'Good'],
    [65, 'Good'],
    [64, 'Fair'],
    [50, 'Fair'],
    [49, 'Needs work'],
    [0, 'Needs work'],
  ])('captions %d as "%s"', (score, expected) => {
    expect(healthScoreCaption(score)).toBe(expected);
  });
});
