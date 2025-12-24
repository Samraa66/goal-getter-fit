import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    if (regenerateMeals) {
      // The meal plan will be regenerated automatically on next fetch
      // Just clear the current day's plan to force regeneration
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("meal_plans")
        .delete()
        .eq("user_id", userId)
        .eq("plan_date", today);
    }

    if (regenerateWorkouts) {
      // Mark current workout program as inactive to trigger regeneration
      await supabase
        .from("workout_programs")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);
    }
  };

  return {
    checkForProfileUpdates,
    triggerRegeneration,
  };
}
