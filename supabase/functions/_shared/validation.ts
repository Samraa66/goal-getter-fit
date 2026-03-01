/**
 * Validation layer for personalized meal and workout data.
 * Used before inserting into user_meals / user_workouts; invalid items trigger fallback to scaled template.
 */

// ─── Constants (shared with prompts) ─────────────────────────────────────
export const MEAL_CALORIES_MIN = 100;
export const MEAL_CALORIES_MAX = 2000;
export const WORKOUT_SETS_MIN = 1;
export const WORKOUT_SETS_MAX = 20;
export const WORKOUT_REPS_MAX = 100;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProfileForValidation {
  allergies?: string[] | null;
  disliked_foods?: string[] | null;
}

/** Validate a single personalized meal (AI output) before insert */
export function validateMealPersonalization(
  meal: {
    personalized_data?: unknown;
    total_calories?: number | null;
    total_protein?: number | null;
    total_carbs?: number | null;
    total_fats?: number | null;
  },
  profile: ProfileForValidation
): ValidationResult {
  const errors: string[] = [];

  if (!meal || typeof meal !== "object") {
    return { valid: false, errors: ["Meal must be an object"] };
  }

  const data = meal.personalized_data;
  if (!data || typeof data !== "object") {
    errors.push("personalized_data is required and must be an object");
  } else {
    const d = data as Record<string, unknown>;
    if (typeof d.meal_name !== "string") errors.push("personalized_data.meal_name must be a string");
    if (!Array.isArray(d.ingredients)) {
      errors.push("personalized_data.ingredients must be an array");
    } else {
      for (let i = 0; i < d.ingredients.length; i++) {
        const ing = d.ingredients[i];
        if (!ing || typeof ing !== "object") {
          errors.push(`ingredients[${i}] must be an object`);
          continue;
        }
        const row = ing as Record<string, unknown>;
        if (typeof row.ingredient_name !== "string") errors.push(`ingredients[${i}].ingredient_name required`);
        const grams = typeof row.grams === "number" ? row.grams : Number(row.grams);
        if (Number.isNaN(grams) || grams <= 0) errors.push(`ingredients[${i}].grams must be a positive number`);
        const cal = typeof row.calories === "number" ? row.calories : Number(row.calories);
        if (Number.isNaN(cal) || cal < 0) errors.push(`ingredients[${i}].calories must be non-negative`);
        const pg = typeof row.protein_g === "number" ? row.protein_g : Number(row.protein_g);
        if (Number.isNaN(pg) || pg < 0) errors.push(`ingredients[${i}].protein_g must be non-negative`);
      }
    }
  }

  const totalCal = meal.total_calories ?? 0;
  if (typeof totalCal !== "number" || totalCal < MEAL_CALORIES_MIN || totalCal > MEAL_CALORIES_MAX) {
    errors.push(`total_calories must be between ${MEAL_CALORIES_MIN} and ${MEAL_CALORIES_MAX}`);
  }

  const allergies = profile?.allergies ?? [];
  const disliked = profile?.disliked_foods ?? [];
  const allAvoided = [...new Set([...allergies, ...disliked])].map((a) => String(a).toLowerCase());
  if (allAvoided.length > 0 && data && typeof data === "object" && Array.isArray((data as any).ingredients)) {
    for (const ing of (data as any).ingredients) {
      const name = String(ing?.ingredient_name ?? "").toLowerCase();
      for (const a of allAvoided) {
        if (name.includes(a) || a.includes(name)) {
          errors.push(`Ingredient may contain allergen/avoided: ${ing?.ingredient_name}`);
          break;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Validate a single personalized workout (AI output) before insert */
export function validateWorkoutPersonalization(workout: {
  personalized_data?: unknown;
}): ValidationResult {
  const errors: string[] = [];

  if (!workout || typeof workout !== "object") {
    return { valid: false, errors: ["Workout must be an object"] };
  }

  const data = workout.personalized_data;
  if (!data || typeof data !== "object") {
    errors.push("personalized_data is required and must be an object");
  } else {
    const d = data as Record<string, unknown>;
    if (typeof d.workout_name !== "string") errors.push("personalized_data.workout_name must be a string");
    if (!Array.isArray(d.exercises)) {
      errors.push("personalized_data.exercises must be an array");
    } else {
      for (let i = 0; i < d.exercises.length; i++) {
        const ex = d.exercises[i];
        if (!ex || typeof ex !== "object") {
          errors.push(`exercises[${i}] must be an object`);
          continue;
        }
        const row = ex as Record<string, unknown>;
        if (typeof row.exercise_name !== "string") errors.push(`exercises[${i}].exercise_name required`);
        const sets = typeof row.sets === "number" ? row.sets : Number(row.sets);
        if (!Number.isNaN(sets) && (sets < WORKOUT_SETS_MIN || sets > WORKOUT_SETS_MAX)) {
          errors.push(`exercises[${i}].sets must be between ${WORKOUT_SETS_MIN} and ${WORKOUT_SETS_MAX}`);
        }
        const reps = row.reps;
        if (typeof reps === "number" && (reps < 1 || reps > WORKOUT_REPS_MAX)) {
          errors.push(`exercises[${i}].reps out of range`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
