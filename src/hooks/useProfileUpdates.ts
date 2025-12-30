import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitPlanRefresh } from "./usePlanRefresh";

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

export function useProfileUpdates() {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationType, setRegenerationType] = useState<'meal' | 'workout' | 'both' | null>(null);

  const checkForProfileUpdates = useCallback(async (
    message: string,
    userId: string
  ): Promise<ProfileUpdateResult> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-profile-updates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

    const promises: Promise<{ success: boolean; type: string }>[] = [];

    if (regenerateMeals) {
      promises.push(
        (async () => {
          try {
            // Delete current day's meal plan to force regeneration
            const today = new Date().toISOString().split("T")[0];
            const { error } = await supabase
              .from("meal_plans")
              .delete()
              .eq("user_id", userId)
              .eq("plan_date", today);
            
            if (error) {
              console.error("Failed to delete meal plan for regeneration:", error);
              return { success: false, type: 'meal' };
            }
            
            console.log("Meal plan deleted, triggering regeneration");
            
            // Trigger meal plan generation
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-meal-plan`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ 
                  userId, 
                  date: today,
                  isModification: true 
                }),
              }
            );

            if (!response.ok) {
              console.error("Failed to regenerate meal plan:", response.status);
              return { success: false, type: 'meal' };
            }

            // Emit event to refresh meals on any listening pages
            emitPlanRefresh("meals");
            return { success: true, type: 'meal' };
          } catch (err) {
            console.error("Meal regeneration error:", err);
            return { success: false, type: 'meal' };
          }
        })()
      );
    }

    if (regenerateWorkouts) {
      promises.push(
        (async () => {
          try {
            // Mark current workout program as inactive
            const { error: deactivateError } = await supabase
              .from("workout_programs")
              .update({ is_active: false })
              .eq("user_id", userId)
              .eq("is_active", true);
            
            if (deactivateError) {
              console.error("Failed to deactivate workout program:", deactivateError);
              return { success: false, type: 'workout' };
            }
            
            console.log("Workout program deactivated, triggering regeneration");
            
            // Trigger workout program generation
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-workout-program`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ 
                  userId,
                  isModification: true 
                }),
              }
            );

            if (!response.ok) {
              console.error("Failed to regenerate workout program:", response.status);
              return { success: false, type: 'workout' };
            }

            // Emit event to refresh workouts on any listening pages
            emitPlanRefresh("workouts");
            return { success: true, type: 'workout' };
          } catch (err) {
            console.error("Workout regeneration error:", err);
            return { success: false, type: 'workout' };
          }
        })()
      );
    }

    const results = await Promise.all(promises);
    const allSuccessful = results.every(r => r.success);
    const failedTypes = results.filter(r => !r.success).map(r => r.type);

    setIsRegenerating(false);
    setRegenerationType(null);

    if (allSuccessful) {
      toast.success("Your plan has been updated!", {
        description: "Check the Meals or Workouts tab to see your new plan.",
      });
      return { success: true };
    } else {
      toast.error("Couldn't update your plan", {
        description: "Please try again in a moment.",
      });
      return { success: false, error: `Failed to regenerate: ${failedTypes.join(', ')}` };
    }
  }, []);

  return {
    checkForProfileUpdates,
    triggerRegeneration,
    isRegenerating,
    regenerationType,
  };
}
