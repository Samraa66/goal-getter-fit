import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import type { WorkoutTemplate, UserWorkout } from "@/types/templates";

export function useTemplateWorkouts() {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [userWorkouts, setUserWorkouts] = useState<UserWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const isPremium = tier === "paid";

  // Fetch current week's user workouts
  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Get workouts for current week (last 7 days to next 7 days)
      const { data, error } = await supabase
        .from("user_workouts")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week");

      if (error) throw error;
      setUserWorkouts((data || []) as unknown as UserWorkout[]);
    } catch (error) {
      console.error("Error fetching user workouts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Generate workout program from templates
  const generateProgram = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("fitness_goal, experience_level, workout_location, workouts_per_week")
        .eq("id", user.id)
        .single();

      const goalType = mapGoalToTemplateType(profile?.fitness_goal);
      const difficulty = profile?.experience_level || "beginner";
      const workoutsPerWeek = profile?.workouts_per_week || 3;

      // Fetch matching workout templates
      let query = supabase
        .from("workout_templates")
        .select("*")
        .eq("goal_type", goalType);

      if (difficulty) {
        query = query.eq("difficulty", difficulty);
      }

      const { data: templates, error: tErr } = await query;

      if (tErr) throw tErr;
      if (!templates || templates.length === 0) {
        toast.error("No workout templates available yet. Check back soon!");
        return;
      }

      // Delete existing user workouts
      await supabase
        .from("user_workouts")
        .delete()
        .eq("user_id", user.id);

      if (isPremium) {
        // Premium: AI personalization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No active session");

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personalize-workout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ templates, workoutsPerWeek }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Personalization failed");
        }

        await fetchWorkouts();
      } else {
        // Free: use templates directly
        const selected = selectWorkoutsForWeek(
          templates as unknown as WorkoutTemplate[],
          workoutsPerWeek
        );

        const today = format(new Date(), "yyyy-MM-dd");
        const dayMappings: Record<number, number[]> = {
          1: [1],
          2: [1, 4],
          3: [1, 3, 5],
          4: [1, 2, 4, 5],
          5: [1, 2, 3, 5, 6],
          6: [1, 2, 3, 4, 5, 6],
        };
        const days = dayMappings[selected.length] || dayMappings[3];

        const inserts = selected.map((t, i) => ({
          user_id: user.id,
          base_template_id: t.id,
          personalized_data: t.data as unknown as Json,
          date_assigned: today,
          day_of_week: days[i] || i + 1,
        }));

        const { error: insertErr } = await supabase
          .from("user_workouts")
          .insert(inserts);

        if (insertErr) throw insertErr;
        await fetchWorkouts();
      }

      toast.success("Workout program generated!");
    } catch (error) {
      console.error("Error generating workout program:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate program");
    } finally {
      setIsGenerating(false);
    }
  }, [user, isPremium, fetchWorkouts]);

  // Complete a workout
  const completeWorkout = async (workoutId: string) => {
    try {
      const { error } = await supabase
        .from("user_workouts")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", workoutId);

      if (error) throw error;
      setUserWorkouts((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, is_completed: true } : w))
      );
      toast.success("Workout completed!");
    } catch (error) {
      console.error("Error completing workout:", error);
      toast.error("Failed to complete workout");
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const today = new Date().getDay();
  const todayWorkout = userWorkouts.find((w) => w.day_of_week === today);
  const completedThisWeek = userWorkouts.filter((w) => w.is_completed).length;

  return {
    userWorkouts,
    todayWorkout,
    completedThisWeek,
    isLoading,
    isGenerating,
    generateProgram,
    completeWorkout,
    refetch: fetchWorkouts,
  };
}

// Map profile fitness_goal values to template goal_type values
function mapGoalToTemplateType(fitnessGoal: string | null | undefined): string {
  const mapping: Record<string, string> = {
    gain_muscle: "muscle_gain",
    lose_weight: "weight_loss",
    improve_fitness: "general_health",
    maintain: "general_health",
    bulk: "bulk",
    muscle_gain: "muscle_gain",
    weight_loss: "weight_loss",
    general_health: "general_health",
  };
  return mapping[fitnessGoal || ""] || "general_health";
}

function selectWorkoutsForWeek(
  templates: WorkoutTemplate[],
  count: number
): WorkoutTemplate[] {
  // Shuffle and pick up to `count` templates
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
