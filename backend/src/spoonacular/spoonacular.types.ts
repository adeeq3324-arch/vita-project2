/**
 * What the food knowledge base gives back, expressed in this platform's own
 * terms rather than the vendor's.
 *
 * Nothing outside `spoonacular.service.ts` sees a Spoonacular response shape.
 * The service translates on the way out — grams stay grams, milligrams stay
 * milligrams, and every figure is *per serving of the published recipe*, which
 * is the one unit the rest of the code has to reason about.
 */

/**
 * Measured nutrition for one serving of a matched dish.
 *
 * The first five are the platform's own daily targets, so they arrive in the
 * same order and the same units everything else counts in. The rest are the
 * reason a lookup is worth making at all: saturated fat, sugar and sodium are
 * exactly the figures a user with high blood pressure or diabetes has been told
 * to watch, and the model can only ever guess at them.
 */
export interface DishNutrition {
  calories: number;
  /** Grams. */
  protein: number;
  /** Grams. */
  carbs: number;
  /** Grams. */
  fat: number;
  /** Grams. */
  fiber: number;

  /** Grams. Null when the source did not report it. */
  saturatedFat: number | null;
  /** Grams. Null when the source did not report it. */
  sugar: number | null;
  /** Milligrams. Null when the source did not report it. */
  sodiumMg: number | null;
  /** Milligrams. Null when the source did not report it. */
  cholesterolMg: number | null;
  /** Milligrams. Null when the source did not report it. */
  potassiumMg: number | null;
}

/**
 * A published dish the knowledge base believes is the one that was named.
 *
 * `confidence` travels with the match rather than being decided inside the
 * service, because how good a match has to be depends on what it is being used
 * for: a photograph beside a card tolerates a loose match, and rewriting a
 * meal's macros against it does not.
 */
export interface DishMatch {
  /** The source's own identifier, kept so a recipe can be fetched later. */
  recipeId: number;
  /** The dish as the source titles it, which may differ from what was asked for. */
  title: string;
  imageUrl: string | null;
  /** How many the published recipe feeds. Nutrition below is for one of them. */
  servings: number;
  /** Prep and cook combined, as the source reports it. */
  readyInMinutes: number;
  /** Where the recipe was published, for attribution. */
  sourceUrl: string | null;
  sourceName: string | null;
  /** Null when the search returned the dish without its nutrition panel. */
  nutrition: DishNutrition | null;
  /**
   * How much of the requested dish name the matched title accounts for, 0–1.
   * See {@link DishMatch} on why the caller decides what is good enough.
   */
  confidence: number;
}

/** One line of a published shopping list. */
export interface SourcedIngredient {
  name: string;
  /** Metric where the source provides it, e.g. "227 g". */
  quantity: string;
  /** Preparation the line calls for, e.g. "cooked, refrigerated". */
  note: string | null;
}

/** One step of a published method. */
export interface SourcedStep {
  title: string;
  instruction: string;
  /** Minutes the step itself takes, when the source timed it. */
  minutes: number | null;
}

/**
 * A published method, ready to be stored as this platform's own recipe.
 *
 * Deliberately the same vocabulary as `meal_recipes`: a recipe that came from a
 * cookbook and one the model wrote are indistinguishable to every screen that
 * renders them, and the only thing that changes is the attribution line.
 */
export interface SourcedRecipe {
  recipeId: number;
  title: string;
  imageUrl: string | null;
  summary: string;
  cuisine: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: SourcedIngredient[];
  steps: SourcedStep[];
  /** Practical notes drawn from what the source states about the dish. */
  tips: string[];
  sourceUrl: string | null;
  sourceName: string | null;
}
