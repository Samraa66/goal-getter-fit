import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitPlanRefresh } from "./usePlanRefresh";
import { format } from "date-fns";

interface ProfileUpdateResult {
  hasUpdates: boolean;
  updates?: Record<string, any>;
  weeklyActivities?: { activities?: string[]; notes?: string };
  needsMealRegeneration?: boolean;
  needsWorkoutRegeneration?: boolean;
  planModification?: {
    type: 'meal' | 'workout' | null;
    targetMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
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

  const triggerRegeneration = useCallback(async (
    userId: string,
    regenerateMeals: boolean,
    regenerateWorkouts: boolean,
    options?: {
      date?: string;
      weeklyActivities?: ProfileUpdateResult["weeklyActivities"];
      planModification?: ProfileUpdateResult["planModification"];
    }
  ): Promise<{ success: boolean; error?: string; coachMessage?: string }> => {
    if (!regenerateMeals && !regenerateWorkouts) {
      return { success: true };
    }

    setIsRegenerating(true);
    if (regenerateMeals && regenerateWorkouts) {
      setRegenerationType('both');
    } else if (regenerateMeals) {
      setRegenerationType('meal');
    } else {
      setRegenerationType('workout');
    }

    const promises: Promise<{ success: boolean; type: string; error?: string; coachMessage?: string }>[] = [];
    const targetDate = options?.date || format(new Date(), "yyyy-MM-dd");
    const planModification = options?.planModification;

    if (regenerateMeals) {
      promises.push(
        (async () => {
          try {
            const accessToken = await getAccessToken();
            if (!accessToken) return { success: false, type: 'meal', error: 'No active session' };

            const hasTargetMeal = planModification?.type === 'meal' && planModification?.targetMealType;

            if (hasTargetMeal) {
              // SCOPED UPDATE: swap a single meal via swap-meal
              console.log(`Triggering scoped meal swap for ${planModification.targetMealType}...`);
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/swap-meal`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                  body: JSON.stringify({
                    date: targetDate,
                    targetMealType: planModification.targetMealType,
                    context: planModification.context,
                    reason: planModification.reason,
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { success: false, type: 'meal', error: errorData.error || `HTTP ${response.status}` };
              }

              const result = await response.json();
              if (!result.success) return { success: false, type: 'meal', error: result.error || 'Failed to swap meal' };

              emitPlanRefresh("meals");
              return {
                success: true,
                type: 'meal',
                coachMessage: result.message || `I updated your ${planModification.targetMealType}.`,
              };
            } else {
              // FULL REGENERATION: Use template-based generate-weekly-meal-plan
              console.log("Triggering full meal plan regeneration via template engine...");
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-weekly-meal-plan`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                  body: JSON.stringify({}),
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { success: false, type: 'meal', error: errorData.error || `HTTP ${response.status}` };
              }

              emitPlanRefresh("meals");
              return { success: true, type: 'meal' };
            }
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
            const accessToken = await getAccessToken();
            if (!accessToken) return { success: false, type: 'workout', error: 'No active session' };

            // Template-based workout generation via personalize-workout
            console.log("Triggering template-based workout regeneration...");
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personalize-workout`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({}),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              return { success: false, type: 'workout', error: errorData.error || `HTTP ${response.status}` };
            }

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
    const coachMessage = results.find(r => r.coachMessage)?.coachMessage;

    setIsRegenerating(false);
    setRegenerationType(null);

    if (allSuccessful) {
      if (!coachMessage) {
        toast.success("Your plan has been updated!", {
          description: "Check the Meals or Workouts tab to see your new plan.",
        });
      }
      return { success: true, coachMessage };
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
