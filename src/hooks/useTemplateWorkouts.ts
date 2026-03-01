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

  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
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

  const generateProgram = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("fitness_goal, experience_level, workout_location, workouts_per_week, preferred_split, other_sports")
        .eq("id", user.id)
        .single();

      const goalType = mapGoalToTemplateType(profile?.fitness_goal);
      const difficulty = profile?.experience_level || "beginner";
      const workoutsPerWeek = profile?.workouts_per_week || 3;
      const preferredSplit = profile?.preferred_split || inferSplit(workoutsPerWeek);
      const workoutLocation = profile?.workout_location || "gym";
      const otherSports = profile?.other_sports || [];

      // Map location to equipment type
      const equipmentType = mapLocationToEquipment(workoutLocation);

      // Fetch templates matching goal, difficulty, and split
      let query = supabase
        .from("workout_templates")
        .select("*")
        .eq("goal_type", goalType)
        .eq("training_split", preferredSplit);

      if (difficulty) {
        query = query.eq("difficulty", difficulty);
      }

      const { data: templates, error: tErr } = await query;

      if (tErr) throw tErr;

      // Fallback: if no templates match the split, try without split filter
      let finalTemplates = templates;
      if (!finalTemplates || finalTemplates.length === 0) {
        const { data: fallback } = await supabase
          .from("workout_templates")
          .select("*")
          .eq("goal_type", goalType);
        finalTemplates = fallback;
      }

      if (!finalTemplates || finalTemplates.length === 0) {
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
            body: JSON.stringify({
              templates: finalTemplates,
              workoutsPerWeek,
              preferredSplit,
              otherSports,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          if (response.status === 429) {
            toast.error("Rate limit", {
              description: err.error || err.message || "Wait a moment before trying again.",
            });
            return;
          }
          if (response.status === 402) {
            toast.error("Limit reached", {
              description: err.error || err.message || "Upgrade for more AI personalization.",
            });
            return;
          }
          throw new Error(err.error || "Personalization failed");
        }

        await fetchWorkouts();
      } else {
        // Free: smart template selection
        const selected = buildWeeklyProgram(
          finalTemplates as unknown as WorkoutTemplate[],
          workoutsPerWeek,
          preferredSplit,
          otherSports
        );

        const today = format(new Date(), "yyyy-MM-dd");
        const days = assignWorkoutDays(selected.length, workoutsPerWeek);

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

  const completeWorkout = async (workoutId: string) => {
    try {
      const workout = userWorkouts.find((w) => w.id === workoutId);
      const { error } = await supabase
        .from("user_workouts")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", workoutId);

      if (error) throw error;
      setUserWorkouts((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, is_completed: true } : w))
      );

      if (workout?.base_template_id) {
        const workoutType = (workout.personalized_data as { workout_name?: string })?.workout_name || "unknown";
        supabase.functions
          .invoke("log-user-signal", {
            body: {
              signal_type: "workout_completed",
              payload: { workout_template_id: workout.base_template_id, workout_type: workoutType },
            },
          })
          .catch(() => {});
      }

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

// ─── Helper Functions ────────────────────────────────────────

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

/** Infer a training split from workouts per week if user hasn't set one */
function inferSplit(workoutsPerWeek: number): string {
  if (workoutsPerWeek <= 3) return "full_body";
  if (workoutsPerWeek <= 4) return "upper_lower";
  if (workoutsPerWeek <= 5) return "ppl";
  return "bro_split";
}

function mapLocationToEquipment(location: string): string {
  const map: Record<string, string> = {
    gym: "full_gym",
    home: "minimal",
    outdoor: "bodyweight",
  };
  return map[location] || "full_gym";
}

/** Build a balanced weekly program based on the training split */
function buildWeeklyProgram(
  templates: WorkoutTemplate[],
  count: number,
  split: string,
  otherSports: string[]
): WorkoutTemplate[] {
  // Separate regular workouts from active recovery
  const regular = templates.filter((t) => !(t as any).is_active_recovery);
  const recovery = templates.filter((t) => (t as any).is_active_recovery);

  // Group regular templates by muscle_group_focus
  const byFocus: Record<string, WorkoutTemplate[]> = {};
  for (const t of regular) {
    const focus = (t as any).muscle_group_focus || "full_body";
    if (!byFocus[focus]) byFocus[focus] = [];
    byFocus[focus].push(t);
  }

  const selected: WorkoutTemplate[] = [];

  // Build based on split type
  switch (split) {
    case "ppl": {
      // Push, Pull, Legs rotation
      const rotation = ["push", "pull", "lower"];
      for (let i = 0; i < count && i < 6; i++) {
        const focus = rotation[i % rotation.length];
        const pool = byFocus[focus] || [];
        if (pool.length > 0) {
          selected.push(pickRandom(pool, selected));
        }
      }
      break;
    }
    case "upper_lower": {
      const rotation = ["upper", "lower"];
      for (let i = 0; i < count && i < 6; i++) {
        const focus = rotation[i % rotation.length];
        const pool = byFocus[focus] || [];
        if (pool.length > 0) {
          selected.push(pickRandom(pool, selected));
        }
      }
      break;
    }
    case "bro_split": {
      // Chest, Back, Shoulders, Legs, Arms
      const rotation = ["push", "pull", "push", "legs"];
      for (let i = 0; i < count && i < 6; i++) {
        const focus = rotation[i % rotation.length];
        const pool = byFocus[focus] || [];
        if (pool.length > 0) {
          selected.push(pickRandom(pool, selected));
        }
      }
      break;
    }
    case "full_body":
    default: {
      const pool = byFocus["full_body"] || regular;
      for (let i = 0; i < count; i++) {
        if (pool.length > 0) {
          selected.push(pickRandom(pool, selected));
        }
      }
      break;
    }
  }

  // If we couldn't fill enough slots, pad with any remaining templates
  if (selected.length < count) {
    const remaining = regular.filter((t) => !selected.includes(t));
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    for (const t of shuffled) {
      if (selected.length >= count) break;
      selected.push(t);
    }
  }

  return selected.slice(0, count);
}

/** Pick a random template from pool, preferring ones not already selected */
function pickRandom(pool: WorkoutTemplate[], alreadySelected: WorkoutTemplate[]): WorkoutTemplate {
  const unused = pool.filter((t) => !alreadySelected.includes(t));
  const source = unused.length > 0 ? unused : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/** Assign day-of-week numbers ensuring rest between high-stress days */
function assignWorkoutDays(count: number, _workoutsPerWeek: number): number[] {
  const dayMappings: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
  };
  return dayMappings[count] || dayMappings[3];
}
