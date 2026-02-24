import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Json } from "@/integrations/supabase/types";

interface CompletedExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
}

interface CompletedWorkout {
  id: string;
  name: string;
  workout_type: string;
  duration_minutes: number;
  completed_at: string;
  exercises: CompletedExercise[];
}

export function useWorkoutHistory() {
  const { user } = useAuth();
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: workouts } = await supabase
        .from("user_workouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(50);

      if (!workouts || workouts.length === 0) {
        setCompletedWorkouts([]);
        return;
      }

      const mapped: CompletedWorkout[] = workouts.map((w) => {
        const data = w.personalized_data as Record<string, any> | null;
        const exercises: CompletedExercise[] = (data?.exercises || []).map((e: any, i: number) => ({
          id: `${w.id}-${i}`,
          name: e.name || "Unknown",
          sets: e.sets || 0,
          reps: e.reps || "",
          weight: e.weight,
        }));

        return {
          id: w.id,
          name: data?.name || "Workout",
          workout_type: data?.workout_type || "strength",
          duration_minutes: data?.duration_minutes || 0,
          completed_at: w.completed_at!,
          exercises,
        };
      });

      setCompletedWorkouts(mapped);
    } catch (error) {
      console.error("Error fetching workout history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    completedWorkouts,
    isLoading,
    refetch: fetchHistory,
  };
}
