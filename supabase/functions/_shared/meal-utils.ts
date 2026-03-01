/**
 * Shared meal template scaling. Used for deterministic fallback when AI personalization fails or is invalid.
 */

/** Scale template ingredient quantities to hit target calories; preserve structure */
export function scaleTemplate(template: {
  data: unknown;
  per_serving_calories?: number | null;
}, targetCalories: number): Record<string, unknown> {
  const templateCalories = template.per_serving_calories || 500;
  if (templateCalories <= 0) return (template.data as Record<string, unknown>) || {};

  const ratio = targetCalories / templateCalories;
  const data = JSON.parse(JSON.stringify(template.data)) as Record<string, unknown>;

  const ingredients = data.ingredients as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      ing.grams = Math.round((Number(ing.grams) || 0) * ratio);
      ing.calories = Math.round((Number(ing.calories) || 0) * ratio);
      ing.protein_g = Math.round(((Number(ing.protein_g) || 0) * ratio) * 10) / 10;
      ing.carbs_g = Math.round(((Number(ing.carbs_g) || 0) * ratio) * 10) / 10;
      ing.fats_g = Math.round(((Number(ing.fats_g) || 0) * ratio) * 10) / 10;
    }
  }

  return data;
}

/** Compute total macros from scaled data (ingredients array) */
export function macrosFromScaledData(data: Record<string, unknown>): {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
} {
  const ingredients = (data.ingredients as Array<Record<string, unknown>>) || [];
  let total_calories = 0;
  let total_protein = 0;
  let total_carbs = 0;
  let total_fats = 0;
  for (const ing of ingredients) {
    total_calories += Number(ing.calories) || 0;
    total_protein += Number(ing.protein_g) || 0;
    total_carbs += Number(ing.carbs_g) || 0;
    total_fats += Number(ing.fats_g) || 0;
  }
  return {
    total_calories: Math.round(total_calories),
    total_protein: Math.round(total_protein * 10) / 10,
    total_carbs: Math.round(total_carbs * 10) / 10,
    total_fats: Math.round(total_fats * 10) / 10,
  };
}
