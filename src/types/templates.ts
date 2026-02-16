// ============================================
// Template-Based Architecture Types
// ============================================

// --- Meal Templates ---

export interface MealIngredient {
  ingredient_name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

export interface MealStructure {
  meal_name: string;
  servings: number;
  ingredients: MealIngredient[];
  recipe_steps?: string[];
}

export interface MealTemplate {
  id: string;
  name: string;
  goal_type: string | null;
  meal_type: string | null;
  servings: number | null;
  per_serving_calories: number | null;
  per_serving_protein: number | null;
  per_serving_carbs: number | null;
  per_serving_fats: number | null;
  tags: string[] | null;
  data: MealStructure;
  difficulty?: string | null;
}

// --- Workout Templates ---

export interface WorkoutExercise {
  exercise_name: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  muscle_group: string;
  how_to?: string;
}

export interface WorkoutStructure {
  workout_name: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  goal_type: string | null;
  difficulty: string | null;
  duration_minutes: number | null;
  equipment_type: string | null;
  tags: string[] | null;
  data: WorkoutStructure;
}

// --- User Personalized Plans ---

export interface UserMeal {
  id: string;
  user_id: string;
  base_template_id: string | null;
  personalized_data: MealStructure;
  date_assigned: string;
  meal_type: string;
  is_completed: boolean;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fats: number | null;
  created_at: string;
}

export interface UserWorkout {
  id: string;
  user_id: string;
  base_template_id: string | null;
  personalized_data: WorkoutStructure;
  date_assigned: string;
  day_of_week: number | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}
