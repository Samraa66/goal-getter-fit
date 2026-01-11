import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitPlanRefresh } from "./usePlanRefresh";
import { format } from "date-fns";

interface ProfileUpdateResult {
  hasUpdates: boolean;
  updates?: Record<string, any>;
  needsMealRegeneration?: boolean;
  needsWorkoutRegeneration?: boolean;
  planModification?: {
    type: 'meal' | 'workout' | null;
    reason?: string;
    context?: string;
  };
  message?: string;
}

// Helper to get session access token
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export function useProfileUpdates() {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationType, setRegenerationType] = useState<'meal' | 'workout' | 'both' | null>(null);

  const checkForProfileUpdates = useCallback(async (
    message: string,
    userId: string
  ): Promise<ProfileUpdateResult> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.error("No active session for profile update check");
        return { hasUpdates: false };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-profile-updates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message, userId }),
        }
      );

      if (!response.ok) {
        console.error("Profile update check failed:", response.status);
        return { hasUpdates: false };
      }

      const result: ProfileUpdateResult = await response.json();
      
      // Only show toast for profile updates, not plan modifications
      // (Plan modifications will show a dedicated loading state)
      if (result.hasUpdates && result.message && !result.planModification?.type) {
        toast.success(result.message, {
          description: result.needsMealRegeneration || result.needsWorkoutRegeneration
            ? "Your plans will be updated to reflect this change."
            : undefined,
        });
      }

      return result;
    } catch (error) {
      console.error("Error checking for profile updates:", error);
      return { hasUpdates: false };
    }
  }, []);

  // Save generated meal plan to database
  const saveMealPlan = async (
    userId: string,
    generatedPlan: any,
    dateStr: string
  ): Promise<boolean> => {
    try {
      // Delete existing plan for this date if any
      const { data: existingPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", dateStr)
        .maybeSingle();

      if (existingPlan) {
        await supabase.from("meals").delete().eq("meal_plan_id", existingPlan.id);
        await supabase.from("meal_plans").delete().eq("id", existingPlan.id);
      }

      // Save the new meal plan
      const { data: newPlan, error: planInsertError } = await supabase
        .from("meal_plans")
        .insert({
          user_id: userId,
          plan_date: dateStr,
          total_calories: generatedPlan.total_calories,
          total_protein: generatedPlan.total_protein,
          total_carbs: generatedPlan.total_carbs,
          total_fats: generatedPlan.total_fats,
        })
        .select()
        .single();

      if (planInsertError) {
        console.error("Failed to insert meal plan:", planInsertError);
        return false;
      }

      // Save meals
      const mealsToInsert = generatedPlan.meals.map((meal: any) => ({
        meal_plan_id: newPlan.id,
        meal_type: meal.meal_type,
        name: meal.name,
        description: meal.description,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        recipe: meal.recipe,
      }));

      const { error: mealsInsertError } = await supabase
        .from("meals")
        .insert(mealsToInsert);

      if (mealsInsertError) {
        console.error("Failed to insert meals:", mealsInsertError);
        return false;
      }

      console.log("Meal plan saved successfully:", newPlan.id);
      return true;
    } catch (error) {
      console.error("Error saving meal plan:", error);
      return false;
    }
  };

  // Save generated workout program to database
  const saveWorkoutProgram = async (
    userId: string,
    generatedProgram: any
  ): Promise<boolean> => {
    try {
      // Deactivate existing programs
      await supabase
        .from("workout_programs")
        .update({ is_active: false })
        .eq("user_id", userId);

      // Save the new program
      const { data: newProgram, error: programInsertError } = await supabase
        .from("workout_programs")
        .insert({
          user_id: userId,
          name: generatedProgram.program_name || "Workout Program",
          description: generatedProgram.program_description,
          week_number: 1,
          is_active: true,
        })
        .select()
        .single();

      if (programInsertError) {
        console.error("Failed to insert workout program:", programInsertError);
        return false;
      }

      // Save workouts and exercises
      for (const workout of generatedProgram.workouts || []) {
        const { data: newWorkout, error: workoutInsertError } = await supabase
          .from("workouts")
          .insert({
            program_id: newProgram.id,
            name: workout.name,
            workout_type: workout.workout_type,
            day_of_week: workout.day_of_week,
            duration_minutes: workout.duration_minutes,
          })
          .select()
          .single();

        if (workoutInsertError) {
          console.error("Failed to insert workout:", workoutInsertError);
          continue; // Continue with other workouts
        }

        // Save exercises
        const exercisesToInsert = (workout.exercises || []).map((ex: any, index: number) => ({
          workout_id: newWorkout.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds || 60,
          notes: ex.notes,
          order_index: index,
        }));

        if (exercisesToInsert.length > 0) {
          const { error: exercisesInsertError } = await supabase
            .from("exercises")
            .insert(exercisesToInsert);

          if (exercisesInsertError) {
            console.error("Failed to insert exercises:", exercisesInsertError);
          }
        }
      }

      console.log("Workout program saved successfully:", newProgram.id);
      return true;
    } catch (error) {
      console.error("Error saving workout program:", error);
      return false;
    }
  };

  const triggerRegeneration = useCallback(async (
    userId: string,
    regenerateMeals: boolean,
    regenerateWorkouts: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!regenerateMeals && !regenerateWorkouts) {
      return { success: true };
    }

    // Set loading state
    setIsRegenerating(true);
    if (regenerateMeals && regenerateWorkouts) {
      setRegenerationType('both');
    } else if (regenerateMeals) {
      setRegenerationType('meal');
    } else {
      setRegenerationType('workout');
    }

    const promises: Promise<{ success: boolean; type: string; error?: string }>[] = [];
    const today = format(new Date(), "yyyy-MM-dd");

    if (regenerateMeals) {
      promises.push(
        (async () => {
          try {
            // Get fresh access token for regeneration
            const mealAccessToken = await getAccessToken();
            if (!mealAccessToken) {
              console.error("No active session for meal regeneration");
              return { success: false, type: 'meal', error: 'No active session' };
            }
            
            console.log("Triggering meal plan regeneration...");
            
            // Call edge function to generate new meal plan
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-meal-plan`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${mealAccessToken}`,
                },
                body: JSON.stringify({ 
                  date: today,
                  isModification: true 
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error("Failed to generate meal plan:", response.status, errorData);
              return { success: false, type: 'meal', error: errorData.error || `HTTP ${response.status}` };
            }

            const generatedPlan = await response.json();
            
            // Validate the response
            if (!generatedPlan.meals || !Array.isArray(generatedPlan.meals)) {
              console.error("Invalid meal plan response:", generatedPlan);
              return { success: false, type: 'meal', error: 'Invalid meal plan structure' };
            }

            // CRITICAL: Actually save the generated plan to the database
            const saved = await saveMealPlan(userId, generatedPlan, today);
            
            if (!saved) {
              return { success: false, type: 'meal', error: 'Failed to save meal plan' };
            }

            // Emit event to refresh meals on any listening pages
            console.log("Meal plan saved, emitting refresh event");
            emitPlanRefresh("meals");
            return { success: true, type: 'meal' };
          } catch (err) {
            console.error("Meal regeneration error:", err);
            return { success: false, type: 'meal', error: err instanceof Error ? err.message : 'Unknown error' };
          }
        })()
      );
    }

    if (regenerateWorkouts) {
      promises.push(
        (async () => {
          try {
            // Get fresh access token for regeneration
            const workoutAccessToken = await getAccessToken();
            if (!workoutAccessToken) {
              console.error("No active session for workout regeneration");
              return { success: false, type: 'workout', error: 'No active session' };
            }
            
            console.log("Triggering workout program regeneration...");
            
            // Call edge function to generate new workout program
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-workout-program`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${workoutAccessToken}`,
                },
                body: JSON.stringify({ 
                  isModification: true 
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error("Failed to generate workout program:", response.status, errorData);
              return { success: false, type: 'workout', error: errorData.error || `HTTP ${response.status}` };
            }

            const generatedProgram = await response.json();
            
            // Validate the response
            if (!generatedProgram.workouts || !Array.isArray(generatedProgram.workouts)) {
              console.error("Invalid workout program response:", generatedProgram);
              return { success: false, type: 'workout', error: 'Invalid workout program structure' };
            }

            // CRITICAL: Actually save the generated program to the database
            const saved = await saveWorkoutProgram(userId, generatedProgram);
            
            if (!saved) {
              return { success: false, type: 'workout', error: 'Failed to save workout program' };
            }

            // Emit event to refresh workouts on any listening pages
            console.log("Workout program saved, emitting refresh event");
            emitPlanRefresh("workouts");
            return { success: true, type: 'workout' };
          } catch (err) {
            console.error("Workout regeneration error:", err);
            return { success: false, type: 'workout', error: err instanceof Error ? err.message : 'Unknown error' };
          }
        })()
      );
    }

    const results = await Promise.all(promises);
    const allSuccessful = results.every(r => r.success);
    const failedTypes = results.filter(r => !r.success).map(r => `${r.type}: ${r.error || 'Unknown error'}`);

    setIsRegenerating(false);
    setRegenerationType(null);

    if (allSuccessful) {
      toast.success("Your plan has been updated!", {
        description: "Check the Meals or Workouts tab to see your new plan.",
      });
      return { success: true };
    } else {
      const errorMessage = failedTypes.join(', ');
      console.error("Regeneration failures:", errorMessage);
      toast.error("Couldn't update your plan", {
        description: "Please try again in a moment.",
      });
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    checkForProfileUpdates,
    triggerRegeneration,
    isRegenerating,
    regenerationType,
  };
}
