import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

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
      // Get all workout programs for the user
      const { data: programs } = await supabase
        .from("workout_programs")
        .select("id")
        .eq("user_id", user.id);

      if (!programs || programs.length === 0) {
        setCompletedWorkouts([]);
        return;
      }

      const programIds = programs.map(p => p.id);

      // Get all completed workouts
      const { data: workouts } = await supabase
        .from("workouts")
        .select("*")
        .in("program_id", programIds)
        .eq("is_completed", true)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      if (!workouts || workouts.length === 0) {
        setCompletedWorkouts([]);
        return;
      }

      // Fetch exercises for each completed workout
      const workoutsWithExercises = await Promise.all(
        workouts.map(async (workout) => {
          const { data: exercises } = await supabase
            .from("exercises")
            .select("id, name, sets, reps, weight")
            .eq("workout_id", workout.id)
            .order("order_index");

          return {
            id: workout.id,
            name: workout.name,
            workout_type: workout.workout_type,
            duration_minutes: workout.duration_minutes,
            completed_at: workout.completed_at,
            exercises: exercises || [],
          };
        })
      );

      setCompletedWorkouts(workoutsWithExercises);
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
