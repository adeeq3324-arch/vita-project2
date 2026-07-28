import type { FoodCategory } from './food-presentation';

/**
 * A single catalogue entry as authored here. Nutrition figures are **per
 * serving**, matching `serving_label` / `serving_size_g`.
 *
 * `fiber`, `sugar`, `saturatedFat` and `sodium` default to 0 when omitted,
 * which is only done for items where the true value genuinely is (or rounds to)
 * zero — never as a stand-in for unknown data.
 */
export interface StarterFood {
  /** Stable upsert key. Never change one: diary entries link to the row it made. */
  slug: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  servingLabel: string;
  /** Serving mass in grams (millilitres for liquids). */
  servingSizeG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
  /** MaterialCommunityIcons glyph; falls back to the category icon when unset. */
  icon?: string;
}

/**
 * Starter nutrition database — ~115 everyday foods spanning whole ingredients,
 * packaged staples and common prepared meals, so the "Add Meal" search returns
 * useful results from the very first launch.
 *
 * Values follow standard reference data (USDA FoodData Central for generic
 * items; typical restaurant/recipe portions for prepared meals). The seeder is
 * idempotent, so this list is the source of truth: edit an entry here and
 * re-run the seed to correct it everywhere.
 */
export const STARTER_FOODS: readonly StarterFood[] = [
  // ── Fruits ────────────────────────────────────────────────────────────────
  { slug: 'apple-medium', name: 'Apple', category: 'fruits', servingLabel: '1 medium (182 g)', servingSizeG: 182, calories: 95, protein: 0.5, carbs: 25.1, fat: 0.3, fiber: 4.4, sugar: 18.9, sodium: 2, icon: 'food-apple' },
  { slug: 'banana-medium', name: 'Banana', category: 'fruits', servingLabel: '1 medium (118 g)', servingSizeG: 118, calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4, sodium: 1 },
  { slug: 'orange-medium', name: 'Orange', category: 'fruits', servingLabel: '1 medium (131 g)', servingSizeG: 131, calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, fiber: 3.1, sugar: 12.2 },
  { slug: 'strawberries-cup', name: 'Strawberries', category: 'fruits', servingLabel: '1 cup, halves (152 g)', servingSizeG: 152, calories: 49, protein: 1, carbs: 11.7, fat: 0.5, fiber: 3, sugar: 7.4, sodium: 2, icon: 'fruit-cherries' },
  { slug: 'blueberries-cup', name: 'Blueberries', category: 'fruits', servingLabel: '1 cup (148 g)', servingSizeG: 148, calories: 84, protein: 1.1, carbs: 21.4, fat: 0.5, fiber: 3.6, sugar: 14.7, sodium: 1, icon: 'fruit-cherries' },
  { slug: 'grapes-cup', name: 'Grapes', category: 'fruits', servingLabel: '1 cup (151 g)', servingSizeG: 151, calories: 104, protein: 1.1, carbs: 27.3, fat: 0.2, fiber: 1.4, sugar: 23.4, sodium: 3, icon: 'fruit-grapes' },
  { slug: 'avocado-half', name: 'Avocado', category: 'fruits', servingLabel: '1/2 fruit (100 g)', servingSizeG: 100, calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7, saturatedFat: 2.1, sodium: 7 },
  { slug: 'mango-cup', name: 'Mango', category: 'fruits', servingLabel: '1 cup, diced (165 g)', servingSizeG: 165, calories: 99, protein: 1.4, carbs: 24.7, fat: 0.6, fiber: 2.6, sugar: 22.5, sodium: 2 },
  { slug: 'pineapple-cup', name: 'Pineapple', category: 'fruits', servingLabel: '1 cup, chunks (165 g)', servingSizeG: 165, calories: 82, protein: 0.9, carbs: 21.6, fat: 0.2, fiber: 2.3, sugar: 16.3, sodium: 2, icon: 'fruit-pineapple' },
  { slug: 'watermelon-cup', name: 'Watermelon', category: 'fruits', servingLabel: '1 cup, diced (152 g)', servingSizeG: 152, calories: 46, protein: 0.9, carbs: 11.5, fat: 0.2, fiber: 0.6, sugar: 9.4, sodium: 2, icon: 'fruit-watermelon' },
  { slug: 'pear-medium', name: 'Pear', category: 'fruits', servingLabel: '1 medium (178 g)', servingSizeG: 178, calories: 101, protein: 0.6, carbs: 27.1, fat: 0.2, fiber: 5.5, sugar: 17.4, sodium: 2 },
  { slug: 'kiwi-medium', name: 'Kiwi', category: 'fruits', servingLabel: '1 medium (69 g)', servingSizeG: 69, calories: 42, protein: 0.8, carbs: 10.1, fat: 0.4, fiber: 2.1, sugar: 6.2, sodium: 2 },

  // ── Vegetables ────────────────────────────────────────────────────────────
  { slug: 'broccoli-cup-cooked', name: 'Broccoli, cooked', category: 'vegetables', servingLabel: '1 cup, chopped (156 g)', servingSizeG: 156, calories: 55, protein: 3.7, carbs: 11.2, fat: 0.6, fiber: 5.1, sugar: 2.2, sodium: 64 },
  { slug: 'spinach-cup-raw', name: 'Spinach, raw', category: 'vegetables', servingLabel: '1 cup (30 g)', servingSizeG: 30, calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7, sugar: 0.1, sodium: 24, icon: 'leaf' },
  { slug: 'kale-cup-raw', name: 'Kale, raw', category: 'vegetables', servingLabel: '1 cup, chopped (21 g)', servingSizeG: 21, calories: 7, protein: 0.6, carbs: 0.9, fat: 0.3, fiber: 0.9, sugar: 0.2, sodium: 11, icon: 'leaf' },
  { slug: 'carrots-cup', name: 'Carrots', category: 'vegetables', servingLabel: '1 cup, chopped (128 g)', servingSizeG: 128, calories: 52, protein: 1.2, carbs: 12.3, fat: 0.3, fiber: 3.6, sugar: 6.1, sodium: 88, icon: 'carrot' },
  { slug: 'sweet-potato-baked', name: 'Sweet potato, baked', category: 'vegetables', servingLabel: '1 medium (114 g)', servingSizeG: 114, calories: 103, protein: 2.3, carbs: 23.6, fat: 0.2, fiber: 3.8, sugar: 7.4, sodium: 41 },
  { slug: 'potato-baked', name: 'Potato, baked', category: 'vegetables', servingLabel: '1 medium (173 g)', servingSizeG: 173, calories: 161, protein: 4.3, carbs: 36.6, fat: 0.2, fiber: 3.8, sugar: 2, sodium: 17 },
  { slug: 'bell-pepper-medium', name: 'Bell pepper', category: 'vegetables', servingLabel: '1 medium (119 g)', servingSizeG: 119, calories: 31, protein: 1.2, carbs: 7.2, fat: 0.4, fiber: 2.5, sugar: 5, sodium: 4, icon: 'chili-mild' },
  { slug: 'tomato-medium', name: 'Tomato', category: 'vegetables', servingLabel: '1 medium (123 g)', servingSizeG: 123, calories: 22, protein: 1.1, carbs: 4.8, fat: 0.2, fiber: 1.5, sugar: 3.2, sodium: 6 },
  { slug: 'cucumber-cup', name: 'Cucumber', category: 'vegetables', servingLabel: '1 cup, sliced (119 g)', servingSizeG: 119, calories: 16, protein: 0.7, carbs: 3.8, fat: 0.1, fiber: 0.6, sugar: 1.7, sodium: 2 },
  { slug: 'cauliflower-cup', name: 'Cauliflower', category: 'vegetables', servingLabel: '1 cup, chopped (107 g)', servingSizeG: 107, calories: 27, protein: 2.1, carbs: 5.3, fat: 0.3, fiber: 2.1, sugar: 2, sodium: 32 },
  { slug: 'green-beans-cup', name: 'Green beans', category: 'vegetables', servingLabel: '1 cup (125 g)', servingSizeG: 125, calories: 44, protein: 2.4, carbs: 9.9, fat: 0.4, fiber: 4, sugar: 4.6, sodium: 1 },
  { slug: 'onion-medium', name: 'Onion', category: 'vegetables', servingLabel: '1 medium (110 g)', servingSizeG: 110, calories: 44, protein: 1.2, carbs: 10.3, fat: 0.1, fiber: 1.9, sugar: 4.7, sodium: 4 },
  { slug: 'asparagus-cup', name: 'Asparagus', category: 'vegetables', servingLabel: '1 cup (134 g)', servingSizeG: 134, calories: 27, protein: 3, carbs: 5.2, fat: 0.2, fiber: 2.8, sugar: 2.5, sodium: 3, icon: 'sprout' },
  { slug: 'mushrooms-cup', name: 'Mushrooms', category: 'vegetables', servingLabel: '1 cup, sliced (70 g)', servingSizeG: 70, calories: 15, protein: 2.2, carbs: 2.3, fat: 0.2, fiber: 0.7, sugar: 1.4, sodium: 4, icon: 'mushroom' },
  { slug: 'zucchini-cup', name: 'Zucchini', category: 'vegetables', servingLabel: '1 cup, sliced (124 g)', servingSizeG: 124, calories: 21, protein: 1.5, carbs: 3.9, fat: 0.4, fiber: 1.2, sugar: 3.1, sodium: 12 },

  // ── Grains & starches ─────────────────────────────────────────────────────
  { slug: 'white-rice-cooked-cup', name: 'White rice, cooked', category: 'grains', servingLabel: '1 cup (158 g)', servingSizeG: 158, calories: 205, protein: 4.3, carbs: 44.5, fat: 0.4, fiber: 0.6, sugar: 0.1, sodium: 2, icon: 'rice' },
  { slug: 'brown-rice-cooked-cup', name: 'Brown rice, cooked', category: 'grains', servingLabel: '1 cup (195 g)', servingSizeG: 195, calories: 218, protein: 4.5, carbs: 45.8, fat: 1.6, fiber: 3.5, sugar: 0.7, saturatedFat: 0.4, sodium: 10, icon: 'rice' },
  { slug: 'quinoa-cooked-cup', name: 'Quinoa, cooked', category: 'grains', servingLabel: '1 cup (185 g)', servingSizeG: 185, calories: 222, protein: 8.1, carbs: 39.4, fat: 3.6, fiber: 5.2, sugar: 1.6, saturatedFat: 0.4, sodium: 13, icon: 'barley' },
  { slug: 'oats-dry-half-cup', name: 'Rolled oats, dry', category: 'grains', servingLabel: '1/2 cup (40 g)', servingSizeG: 40, calories: 150, protein: 5.3, carbs: 27, fat: 2.6, fiber: 4, sugar: 0.4, saturatedFat: 0.5, icon: 'barley' },
  { slug: 'whole-wheat-bread-slice', name: 'Whole wheat bread', category: 'grains', servingLabel: '1 slice (43 g)', servingSizeG: 43, calories: 110, protein: 5.4, carbs: 20, fat: 1.5, fiber: 3, sugar: 2.5, saturatedFat: 0.3, sodium: 194, icon: 'bread-slice' },
  { slug: 'white-bread-slice', name: 'White bread', category: 'grains', servingLabel: '1 slice (25 g)', servingSizeG: 25, calories: 66, protein: 1.9, carbs: 12.7, fat: 0.8, fiber: 0.6, sugar: 1.4, saturatedFat: 0.2, sodium: 128, icon: 'bread-slice' },
  { slug: 'pasta-cooked-cup', name: 'Pasta, cooked', category: 'grains', servingLabel: '1 cup (140 g)', servingSizeG: 140, calories: 220, protein: 8.1, carbs: 43.2, fat: 1.3, fiber: 2.5, sugar: 0.8, saturatedFat: 0.2, sodium: 1, icon: 'noodles' },
  { slug: 'whole-wheat-pasta-cooked-cup', name: 'Whole wheat pasta, cooked', category: 'grains', servingLabel: '1 cup (140 g)', servingSizeG: 140, calories: 174, protein: 7.5, carbs: 37.2, fat: 0.8, fiber: 4.5, sugar: 1.1, saturatedFat: 0.1, sodium: 4, icon: 'noodles' },
  { slug: 'couscous-cooked-cup', name: 'Couscous, cooked', category: 'grains', servingLabel: '1 cup (157 g)', servingSizeG: 157, calories: 176, protein: 6, carbs: 36.5, fat: 0.3, fiber: 2.2, sugar: 0.2, sodium: 8, icon: 'barley' },
  { slug: 'bagel-plain', name: 'Bagel, plain', category: 'grains', servingLabel: '1 bagel (98 g)', servingSizeG: 98, calories: 257, protein: 10, carbs: 50.5, fat: 1.5, fiber: 2.1, sugar: 5.2, saturatedFat: 0.3, sodium: 460, icon: 'food-croissant' },
  { slug: 'flour-tortilla', name: 'Flour tortilla', category: 'grains', servingLabel: '1 tortilla, 8 in (49 g)', servingSizeG: 49, calories: 146, protein: 3.9, carbs: 24.3, fat: 3.7, fiber: 1.4, sugar: 0.8, saturatedFat: 1, sodium: 364 },
  { slug: 'sweetcorn-cup', name: 'Sweetcorn', category: 'grains', servingLabel: '1 cup, kernels (166 g)', servingSizeG: 166, calories: 143, protein: 5.4, carbs: 31.3, fat: 2.2, fiber: 3.6, sugar: 6.4, saturatedFat: 0.3, sodium: 26, icon: 'corn' },

  // ── Protein ───────────────────────────────────────────────────────────────
  { slug: 'chicken-breast-grilled-100g', name: 'Chicken breast, grilled', category: 'protein', servingLabel: '100 g', servingSizeG: 100, calories: 165, protein: 31, carbs: 0, fat: 3.6, saturatedFat: 1, sodium: 74, icon: 'food-drumstick' },
  { slug: 'chicken-thigh-roasted-100g', name: 'Chicken thigh, roasted', category: 'protein', servingLabel: '100 g', servingSizeG: 100, calories: 209, protein: 26, carbs: 0, fat: 10.9, saturatedFat: 3, sodium: 88, icon: 'food-drumstick' },
  { slug: 'ground-beef-90-cooked-100g', name: 'Ground beef, 90% lean', category: 'protein', servingLabel: '100 g, cooked', servingSizeG: 100, calories: 217, protein: 26.1, carbs: 0, fat: 11.7, saturatedFat: 4.6, sodium: 75, icon: 'food-steak' },
  { slug: 'sirloin-steak-100g', name: 'Sirloin steak', category: 'protein', servingLabel: '100 g, cooked', servingSizeG: 100, calories: 206, protein: 30, carbs: 0, fat: 8.8, saturatedFat: 3.4, sodium: 55, icon: 'food-steak' },
  { slug: 'turkey-breast-100g', name: 'Turkey breast', category: 'protein', servingLabel: '100 g, roasted', servingSizeG: 100, calories: 135, protein: 30.1, carbs: 0, fat: 0.7, saturatedFat: 0.2, sodium: 55, icon: 'food-turkey' },
  { slug: 'pork-tenderloin-100g', name: 'Pork tenderloin', category: 'protein', servingLabel: '100 g, cooked', servingSizeG: 100, calories: 143, protein: 26, carbs: 0, fat: 3.5, saturatedFat: 1.2, sodium: 57 },
  { slug: 'egg-large', name: 'Egg', category: 'protein', servingLabel: '1 large (50 g)', servingSizeG: 50, calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, sugar: 0.2, saturatedFat: 1.6, sodium: 71, icon: 'egg' },
  { slug: 'egg-white-large', name: 'Egg white', category: 'protein', servingLabel: '1 large (33 g)', servingSizeG: 33, calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1, sugar: 0.2, sodium: 55, icon: 'egg' },
  { slug: 'tofu-firm-100g', name: 'Tofu, firm', category: 'protein', servingLabel: '100 g', servingSizeG: 100, calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, fiber: 2.3, sugar: 0.6, saturatedFat: 1.3, sodium: 14 },
  { slug: 'tempeh-100g', name: 'Tempeh', category: 'protein', servingLabel: '100 g', servingSizeG: 100, calories: 192, protein: 20.3, carbs: 7.6, fat: 10.8, saturatedFat: 2.2, sodium: 9 },
  { slug: 'lentils-cooked-cup', name: 'Lentils, cooked', category: 'protein', servingLabel: '1 cup (198 g)', servingSizeG: 198, calories: 230, protein: 17.9, carbs: 39.9, fat: 0.8, fiber: 15.6, sugar: 3.6, saturatedFat: 0.1, sodium: 4 },
  { slug: 'chickpeas-cooked-cup', name: 'Chickpeas, cooked', category: 'protein', servingLabel: '1 cup (164 g)', servingSizeG: 164, calories: 269, protein: 14.5, carbs: 45, fat: 4.2, fiber: 12.5, sugar: 7.9, saturatedFat: 0.4, sodium: 11 },
  { slug: 'black-beans-cooked-cup', name: 'Black beans, cooked', category: 'protein', servingLabel: '1 cup (172 g)', servingSizeG: 172, calories: 227, protein: 15.2, carbs: 40.8, fat: 0.9, fiber: 15, sugar: 0.6, saturatedFat: 0.2, sodium: 2 },
  { slug: 'kidney-beans-cooked-cup', name: 'Kidney beans, cooked', category: 'protein', servingLabel: '1 cup (177 g)', servingSizeG: 177, calories: 225, protein: 15.3, carbs: 40.4, fat: 0.9, fiber: 13.1, sugar: 0.6, saturatedFat: 0.1, sodium: 4 },
  { slug: 'whey-protein-scoop', name: 'Whey protein powder', category: 'protein', servingLabel: '1 scoop (30 g)', servingSizeG: 30, calories: 120, protein: 24, carbs: 3, fat: 1.5, fiber: 0.5, sugar: 2, saturatedFat: 0.8, sodium: 60, icon: 'blender' },

  // ── Seafood ───────────────────────────────────────────────────────────────
  { slug: 'salmon-cooked-100g', name: 'Salmon, cooked', category: 'seafood', servingLabel: '100 g', servingSizeG: 100, calories: 208, protein: 22.1, carbs: 0, fat: 12.4, saturatedFat: 3.1, sodium: 59, icon: 'fish' },
  { slug: 'tuna-canned-water-100g', name: 'Tuna, canned in water', category: 'seafood', servingLabel: '100 g, drained', servingSizeG: 100, calories: 116, protein: 25.5, carbs: 0, fat: 0.8, saturatedFat: 0.2, sodium: 247, icon: 'fish' },
  { slug: 'cod-cooked-100g', name: 'Cod, cooked', category: 'seafood', servingLabel: '100 g', servingSizeG: 100, calories: 105, protein: 22.8, carbs: 0, fat: 0.9, saturatedFat: 0.2, sodium: 78, icon: 'fish' },
  { slug: 'shrimp-cooked-100g', name: 'Shrimp, cooked', category: 'seafood', servingLabel: '100 g', servingSizeG: 100, calories: 99, protein: 24, carbs: 0.2, fat: 0.3, saturatedFat: 0.1, sodium: 111, icon: 'fish' },
  { slug: 'tilapia-cooked-100g', name: 'Tilapia, cooked', category: 'seafood', servingLabel: '100 g', servingSizeG: 100, calories: 128, protein: 26.2, carbs: 0, fat: 2.7, saturatedFat: 0.9, sodium: 56, icon: 'fish' },
  { slug: 'sardines-canned-100g', name: 'Sardines, canned', category: 'seafood', servingLabel: '100 g, drained', servingSizeG: 100, calories: 208, protein: 24.6, carbs: 0, fat: 11.5, saturatedFat: 1.5, sodium: 307, icon: 'fish' },

  // ── Dairy ─────────────────────────────────────────────────────────────────
  { slug: 'milk-whole-cup', name: 'Whole milk', category: 'dairy', servingLabel: '1 cup (244 ml)', servingSizeG: 244, calories: 149, protein: 7.7, carbs: 11.7, fat: 8, sugar: 12.3, saturatedFat: 4.6, sodium: 105, icon: 'cup' },
  { slug: 'milk-skim-cup', name: 'Skim milk', category: 'dairy', servingLabel: '1 cup (245 ml)', servingSizeG: 245, calories: 83, protein: 8.3, carbs: 12.2, fat: 0.2, sugar: 12.5, saturatedFat: 0.1, sodium: 103, icon: 'cup' },
  { slug: 'greek-yogurt-nonfat-170g', name: 'Greek yogurt, nonfat', category: 'dairy', servingLabel: '1 container (170 g)', servingSizeG: 170, calories: 100, protein: 17.3, carbs: 6.1, fat: 0.7, sugar: 5.5, saturatedFat: 0.1, sodium: 61 },
  { slug: 'yogurt-plain-whole-170g', name: 'Plain yogurt, whole milk', category: 'dairy', servingLabel: '1 container (170 g)', servingSizeG: 170, calories: 104, protein: 5.9, carbs: 7.9, fat: 5.5, sugar: 7.9, saturatedFat: 3.5, sodium: 80 },
  { slug: 'cheddar-cheese-28g', name: 'Cheddar cheese', category: 'dairy', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 114, protein: 6.5, carbs: 0.9, fat: 9.4, sugar: 0.1, saturatedFat: 5.4, sodium: 180, icon: 'cheese' },
  { slug: 'mozzarella-28g', name: 'Mozzarella cheese', category: 'dairy', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 85, protein: 6.3, carbs: 0.6, fat: 6.3, sugar: 0.3, saturatedFat: 3.7, sodium: 178, icon: 'cheese' },
  { slug: 'cottage-cheese-lowfat-cup', name: 'Cottage cheese, low-fat', category: 'dairy', servingLabel: '1 cup (226 g)', servingSizeG: 226, calories: 163, protein: 28, carbs: 6.2, fat: 2.3, sugar: 6.2, saturatedFat: 1.4, sodium: 918 },
  { slug: 'butter-tbsp', name: 'Butter', category: 'dairy', servingLabel: '1 tbsp (14 g)', servingSizeG: 14, calories: 102, protein: 0.1, carbs: 0, fat: 11.5, saturatedFat: 7.3, sodium: 91 },
  { slug: 'almond-milk-unsweetened-cup', name: 'Almond milk, unsweetened', category: 'dairy', servingLabel: '1 cup (240 ml)', servingSizeG: 240, calories: 39, protein: 1.5, carbs: 3.4, fat: 2.5, fiber: 0.5, sugar: 2.1, saturatedFat: 0.2, sodium: 176, icon: 'cup' },

  // ── Nuts & seeds ──────────────────────────────────────────────────────────
  { slug: 'almonds-28g', name: 'Almonds', category: 'nuts_and_seeds', servingLabel: '1 oz, ~23 nuts (28 g)', servingSizeG: 28, calories: 164, protein: 6, carbs: 6.1, fat: 14.2, fiber: 3.5, sugar: 1.2, saturatedFat: 1.1, icon: 'peanut' },
  { slug: 'walnuts-28g', name: 'Walnuts', category: 'nuts_and_seeds', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 185, protein: 4.3, carbs: 3.9, fat: 18.5, fiber: 1.9, sugar: 0.7, saturatedFat: 1.7, sodium: 1, icon: 'peanut' },
  { slug: 'cashews-28g', name: 'Cashews', category: 'nuts_and_seeds', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 157, protein: 5.2, carbs: 8.6, fat: 12.4, fiber: 0.9, sugar: 1.7, saturatedFat: 2.2, sodium: 3, icon: 'peanut' },
  { slug: 'peanuts-28g', name: 'Peanuts', category: 'nuts_and_seeds', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 161, protein: 7.3, carbs: 4.6, fat: 14, fiber: 2.4, sugar: 1.3, saturatedFat: 1.9, sodium: 5, icon: 'peanut' },
  { slug: 'peanut-butter-2tbsp', name: 'Peanut butter', category: 'nuts_and_seeds', servingLabel: '2 tbsp (32 g)', servingSizeG: 32, calories: 188, protein: 8, carbs: 6.9, fat: 16.1, fiber: 1.9, sugar: 3.4, saturatedFat: 3.3, sodium: 152, icon: 'peanut' },
  { slug: 'chia-seeds-28g', name: 'Chia seeds', category: 'nuts_and_seeds', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 138, protein: 4.7, carbs: 12, fat: 8.7, fiber: 9.8, saturatedFat: 0.9, sodium: 5, icon: 'seed' },
  { slug: 'pumpkin-seeds-28g', name: 'Pumpkin seeds', category: 'nuts_and_seeds', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 158, protein: 8.5, carbs: 3, fat: 13.9, fiber: 1.8, sugar: 0.4, saturatedFat: 2.5, sodium: 5, icon: 'seed' },

  // ── Fats & oils ───────────────────────────────────────────────────────────
  { slug: 'olive-oil-tbsp', name: 'Olive oil', category: 'fats_and_oils', servingLabel: '1 tbsp (14 g)', servingSizeG: 14, calories: 119, protein: 0, carbs: 0, fat: 13.5, saturatedFat: 1.9 },
  { slug: 'coconut-oil-tbsp', name: 'Coconut oil', category: 'fats_and_oils', servingLabel: '1 tbsp (14 g)', servingSizeG: 14, calories: 121, protein: 0, carbs: 0, fat: 13.5, saturatedFat: 11.2 },
  { slug: 'mayonnaise-tbsp', name: 'Mayonnaise', category: 'fats_and_oils', servingLabel: '1 tbsp (14 g)', servingSizeG: 14, calories: 94, protein: 0.1, carbs: 0.1, fat: 10.3, sugar: 0.1, saturatedFat: 1.6, sodium: 88 },

  // ── Beverages ─────────────────────────────────────────────────────────────
  { slug: 'water-500ml', name: 'Water', category: 'beverages', servingLabel: '500 ml', servingSizeG: 500, calories: 0, protein: 0, carbs: 0, fat: 0, icon: 'cup-water' },
  { slug: 'coffee-black-cup', name: 'Coffee, black', category: 'beverages', servingLabel: '1 cup (237 ml)', servingSizeG: 237, calories: 2, protein: 0.3, carbs: 0, fat: 0, sodium: 5, icon: 'coffee' },
  { slug: 'green-tea-cup', name: 'Green tea', category: 'beverages', servingLabel: '1 cup (245 ml)', servingSizeG: 245, calories: 2, protein: 0.5, carbs: 0, fat: 0, sodium: 2, icon: 'cup' },
  { slug: 'orange-juice-cup', name: 'Orange juice', category: 'beverages', servingLabel: '1 cup (248 ml)', servingSizeG: 248, calories: 112, protein: 1.7, carbs: 25.8, fat: 0.5, fiber: 0.5, sugar: 20.8, saturatedFat: 0.1, sodium: 2, icon: 'cup' },
  { slug: 'cola-can', name: 'Cola', category: 'beverages', servingLabel: '1 can (355 ml)', servingSizeG: 355, calories: 140, protein: 0, carbs: 39, fat: 0, sugar: 39, sodium: 45, icon: 'bottle-soda' },
  { slug: 'sports-drink-500ml', name: 'Sports drink', category: 'beverages', servingLabel: '500 ml', servingSizeG: 500, calories: 126, protein: 0, carbs: 33, fat: 0, sugar: 30, sodium: 220, icon: 'bottle-soda' },
  { slug: 'beer-355ml', name: 'Beer, regular', category: 'beverages', servingLabel: '1 bottle (355 ml)', servingSizeG: 355, calories: 153, protein: 1.6, carbs: 12.6, fat: 0, sodium: 14, icon: 'beer' },
  { slug: 'protein-shake-rtd-330ml', name: 'Protein shake, ready to drink', category: 'beverages', servingLabel: '1 bottle (330 ml)', servingSizeG: 330, calories: 160, protein: 30, carbs: 5, fat: 3, fiber: 1, sugar: 1, saturatedFat: 0.5, sodium: 200, icon: 'blender' },

  // ── Snacks ────────────────────────────────────────────────────────────────
  { slug: 'potato-chips-28g', name: 'Potato chips', category: 'snacks', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 152, protein: 2, carbs: 15, fat: 9.5, fiber: 1.2, sugar: 0.1, saturatedFat: 1.2, sodium: 149, icon: 'french-fries' },
  { slug: 'popcorn-air-popped-cup', name: 'Popcorn, air-popped', category: 'snacks', servingLabel: '1 cup (8 g)', servingSizeG: 8, calories: 31, protein: 1, carbs: 6.2, fat: 0.4, fiber: 1.2, sugar: 0.1, saturatedFat: 0.1, sodium: 1, icon: 'corn' },
  { slug: 'granola-bar', name: 'Granola bar', category: 'snacks', servingLabel: '1 bar (40 g)', servingSizeG: 40, calories: 180, protein: 4, carbs: 29, fat: 6, fiber: 3, sugar: 11, saturatedFat: 1, sodium: 95 },
  { slug: 'rice-cake', name: 'Rice cake', category: 'snacks', servingLabel: '1 cake (9 g)', servingSizeG: 9, calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 29 },
  { slug: 'hummus-2tbsp', name: 'Hummus', category: 'snacks', servingLabel: '2 tbsp (30 g)', servingSizeG: 30, calories: 71, protein: 2, carbs: 6, fat: 4.5, fiber: 1.7, sugar: 0.1, saturatedFat: 0.7, sodium: 114 },
  { slug: 'trail-mix-40g', name: 'Trail mix', category: 'snacks', servingLabel: '1 handful (40 g)', servingSizeG: 40, calories: 187, protein: 5.5, carbs: 17, fat: 12, fiber: 2.5, sugar: 10, saturatedFat: 2.3, sodium: 65, icon: 'peanut' },

  // ── Sweets ────────────────────────────────────────────────────────────────
  { slug: 'dark-chocolate-70-28g', name: 'Dark chocolate, 70%', category: 'sweets', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 170, protein: 2.2, carbs: 13, fat: 12.1, fiber: 3.1, sugar: 6.8, saturatedFat: 7, sodium: 6 },
  { slug: 'milk-chocolate-28g', name: 'Milk chocolate', category: 'sweets', servingLabel: '1 oz (28 g)', servingSizeG: 28, calories: 152, protein: 2.1, carbs: 16.8, fat: 8.5, fiber: 1, sugar: 14.9, saturatedFat: 5.1, sodium: 23 },
  { slug: 'ice-cream-vanilla-half-cup', name: 'Vanilla ice cream', category: 'sweets', servingLabel: '1/2 cup (66 g)', servingSizeG: 66, calories: 137, protein: 2.3, carbs: 15.6, fat: 7.3, fiber: 0.5, sugar: 14, saturatedFat: 4.5, sodium: 53, icon: 'ice-cream' },
  { slug: 'chocolate-chip-cookie', name: 'Chocolate chip cookie', category: 'sweets', servingLabel: '1 cookie (16 g)', servingSizeG: 16, calories: 78, protein: 0.9, carbs: 10.4, fat: 3.9, fiber: 0.4, sugar: 6, saturatedFat: 1.5, sodium: 55, icon: 'cookie' },
  { slug: 'honey-tbsp', name: 'Honey', category: 'sweets', servingLabel: '1 tbsp (21 g)', servingSizeG: 21, calories: 64, protein: 0.1, carbs: 17.3, fat: 0, sugar: 17.2, sodium: 1 },
  { slug: 'glazed-doughnut', name: 'Glazed doughnut', category: 'sweets', servingLabel: '1 doughnut (60 g)', servingSizeG: 60, calories: 260, protein: 3, carbs: 31, fat: 14, fiber: 1, sugar: 14, saturatedFat: 6, sodium: 220, icon: 'cupcake' },

  // ── Prepared meals ────────────────────────────────────────────────────────
  { slug: 'grilled-chicken-salad', name: 'Grilled Chicken Salad', category: 'prepared_meals', servingLabel: '1 bowl (350 g)', servingSizeG: 350, calories: 520, protein: 42, carbs: 30, fat: 24, fiber: 6, sugar: 8, saturatedFat: 5, sodium: 720, icon: 'bowl-mix' },
  { slug: 'oatmeal-with-berries', name: 'Oatmeal with Berries', category: 'prepared_meals', servingLabel: '1 bowl (300 g)', servingSizeG: 300, calories: 340, protein: 12, carbs: 54, fat: 6, fiber: 8, sugar: 16, saturatedFat: 1.2, sodium: 140, icon: 'coffee' },
  { slug: 'protein-smoothie', name: 'Protein Smoothie', category: 'prepared_meals', servingLabel: '1 glass (400 ml)', servingSizeG: 400, calories: 320, protein: 28, carbs: 40, fat: 7, fiber: 5, sugar: 26, saturatedFat: 1.5, sodium: 180, icon: 'cup' },
  { slug: 'scrambled-eggs-2', name: 'Scrambled Eggs', category: 'prepared_meals', servingLabel: '2 eggs (120 g)', servingSizeG: 120, calories: 182, protein: 12.2, carbs: 2, fat: 13.4, sugar: 1.6, saturatedFat: 4.5, sodium: 340, icon: 'egg' },
  { slug: 'pancakes-3', name: 'Pancakes', category: 'prepared_meals', servingLabel: '3 pancakes (114 g)', servingSizeG: 114, calories: 260, protein: 7, carbs: 40, fat: 8, fiber: 1.5, sugar: 9, saturatedFat: 2, sodium: 590, icon: 'muffin' },
  { slug: 'chicken-burrito', name: 'Chicken Burrito', category: 'prepared_meals', servingLabel: '1 burrito (350 g)', servingSizeG: 350, calories: 620, protein: 33, carbs: 68, fat: 24, fiber: 8, sugar: 4, saturatedFat: 8, sodium: 1380, icon: 'taco' },
  { slug: 'margherita-pizza-slice', name: 'Margherita Pizza', category: 'prepared_meals', servingLabel: '1 slice (107 g)', servingSizeG: 107, calories: 250, protein: 10, carbs: 30, fat: 9.5, fiber: 2, sugar: 3.5, saturatedFat: 4.5, sodium: 560, icon: 'pizza' },
  { slug: 'cheeseburger', name: 'Cheeseburger', category: 'prepared_meals', servingLabel: '1 burger (150 g)', servingSizeG: 150, calories: 380, protein: 20, carbs: 33, fat: 18, fiber: 2, sugar: 7, saturatedFat: 8, sodium: 720, icon: 'hamburger' },
  { slug: 'salmon-sushi-roll', name: 'Salmon Sushi Roll', category: 'prepared_meals', servingLabel: '6 pieces (170 g)', servingSizeG: 170, calories: 290, protein: 13, carbs: 42, fat: 7, fiber: 2, sugar: 6, saturatedFat: 1.5, sodium: 480, icon: 'fish' },
  { slug: 'caesar-salad-chicken', name: 'Caesar Salad with Chicken', category: 'prepared_meals', servingLabel: '1 bowl (300 g)', servingSizeG: 300, calories: 470, protein: 33, carbs: 12, fat: 32, fiber: 3, sugar: 4, saturatedFat: 7, sodium: 990, icon: 'bowl-mix' },
  { slug: 'turkey-sandwich', name: 'Turkey Sandwich', category: 'prepared_meals', servingLabel: '1 sandwich (200 g)', servingSizeG: 200, calories: 380, protein: 24, carbs: 44, fat: 11, fiber: 4, sugar: 6, saturatedFat: 3, sodium: 1210, icon: 'bread-slice' },
  { slug: 'beef-stir-fry-rice', name: 'Beef Stir Fry with Rice', category: 'prepared_meals', servingLabel: '1 plate (400 g)', servingSizeG: 400, calories: 560, protein: 32, carbs: 62, fat: 20, fiber: 5, sugar: 9, saturatedFat: 6, sodium: 1150, icon: 'bowl-mix' },
  { slug: 'vegetable-soup-cup', name: 'Vegetable Soup', category: 'prepared_meals', servingLabel: '1 cup (245 g)', servingSizeG: 245, calories: 98, protein: 3.5, carbs: 17, fat: 2, fiber: 3.5, sugar: 6, saturatedFat: 0.5, sodium: 690, icon: 'bowl-mix' },
  { slug: 'chicken-shawarma-wrap', name: 'Chicken Shawarma Wrap', category: 'prepared_meals', servingLabel: '1 wrap (280 g)', servingSizeG: 280, calories: 540, protein: 34, carbs: 52, fat: 20, fiber: 4, sugar: 5, saturatedFat: 5, sodium: 1050, icon: 'taco' },
  { slug: 'greek-salad', name: 'Greek Salad', category: 'prepared_meals', servingLabel: '1 bowl (250 g)', servingSizeG: 250, calories: 210, protein: 6, carbs: 12, fat: 16, fiber: 3.5, sugar: 7, saturatedFat: 5.5, sodium: 620, icon: 'bowl-mix' },

  // ── Condiments ────────────────────────────────────────────────────────────
  { slug: 'ketchup-tbsp', name: 'Ketchup', category: 'condiments', servingLabel: '1 tbsp (17 g)', servingSizeG: 17, calories: 17, protein: 0.2, carbs: 4.5, fat: 0, fiber: 0.1, sugar: 3.7, sodium: 154 },
  { slug: 'soy-sauce-tbsp', name: 'Soy sauce', category: 'condiments', servingLabel: '1 tbsp (16 ml)', servingSizeG: 16, calories: 8, protein: 1.3, carbs: 0.8, fat: 0, fiber: 0.1, sugar: 0.1, sodium: 879 },
  { slug: 'mustard-tsp', name: 'Mustard', category: 'condiments', servingLabel: '1 tsp (5 g)', servingSizeG: 5, calories: 3, protein: 0.2, carbs: 0.3, fat: 0.2, fiber: 0.1, sugar: 0.1, sodium: 57 },
  { slug: 'sriracha-tsp', name: 'Sriracha', category: 'condiments', servingLabel: '1 tsp (5 g)', servingSizeG: 5, calories: 5, protein: 0.1, carbs: 1, fat: 0, fiber: 0.1, sugar: 0.8, sodium: 100, icon: 'chili-mild' },
  { slug: 'ranch-dressing-2tbsp', name: 'Ranch dressing', category: 'condiments', servingLabel: '2 tbsp (30 g)', servingSizeG: 30, calories: 129, protein: 0.4, carbs: 1.8, fat: 13.4, sugar: 1.4, saturatedFat: 2.1, sodium: 270 },
  { slug: 'salsa-2tbsp', name: 'Salsa', category: 'condiments', servingLabel: '2 tbsp (32 g)', servingSizeG: 32, calories: 10, protein: 0.5, carbs: 2.3, fat: 0.1, fiber: 0.6, sugar: 1.3, sodium: 190 },
];
