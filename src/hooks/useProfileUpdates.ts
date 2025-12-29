import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitPlanRefresh } from "./usePlanRefresh";

interface ProfileUpdateResult {
  hasUpdates: boolean;
  updates?: Record<string, any>;
  needsMealRegeneration?: boolean;
  needsWorkoutRegeneration?: boolean;
  message?: string;
}

export function useProfileUpdates() {
  const checkForProfileUpdates = async (
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
      
      if (result.hasUpdates && result.message) {
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
  };

  const triggerRegeneration = async (
    userId: string,
    regenerateMeals: boolean,
    regenerateWorkouts: boolean
  ) => {
    const promises: Promise<void>[] = [];

    if (regenerateMeals) {
      promises.push(
        (async () => {
          // Delete current day's meal plan to force regeneration
          const today = new Date().toISOString().split("T")[0];
          const { error } = await supabase
            .from("meal_plans")
            .delete()
            .eq("user_id", userId)
            .eq("plan_date", today);
          
          if (error) {
            console.error("Failed to delete meal plan for regeneration:", error);
          } else {
            console.log("Meal plan deleted, emitting refresh event");
            // Emit event to refresh meals on any listening pages
            emitPlanRefresh("meals");
          }
        })()
      );
    }

    if (regenerateWorkouts) {
      promises.push(
        (async () => {
          // Mark current workout program as inactive
          const { error } = await supabase
            .from("workout_programs")
            .update({ is_active: false })
            .eq("user_id", userId)
            .eq("is_active", true);
          
          if (error) {
            console.error("Failed to deactivate workout program:", error);
          } else {
            console.log("Workout program deactivated, emitting refresh event");
            // Emit event to refresh workouts on any listening pages
            emitPlanRefresh("workouts");
          }
        })()
      );
    }

    await Promise.all(promises);
  };

  return {
    checkForProfileUpdates,
    triggerRegeneration,
  };
}
