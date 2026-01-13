import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  muscle_groups?: string;
  how_to?: string;
  sets: number;
  reps: string;
  weight?: string;
  rest_seconds: number;
  notes?: string;
  is_completed?: boolean;
  order_index: number;
}

interface Workout {
  id: string;
  name: string;
  workout_type: "strength" | "cardio" | "flexibility";
  day_of_week: number;
  duration_minutes: number;
  is_completed: boolean;
  exercises: Exercise[];
}

interface WorkoutProgram {
  id: string;
  name: string;
  description?: string;
  week_number: number;
  is_active: boolean;
  workouts: Workout[];
}

export function useWorkoutProgram() {
  const { user } = useAuth();
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchProgram = useCallback(async (retryCount = 0) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch active workout program
      const { data: programData, error: programError } = await supabase
        .from("workout_programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (programError) throw programError;

      if (programData) {
        // Fetch workouts for this program
        const { data: workoutsData, error: workoutsError } = await supabase
          .from("workouts")
          .select("*")
          .eq("program_id", programData.id)
          .order("day_of_week");

        if (workoutsError) throw workoutsError;

        // Fetch exercises for each workout
        const workoutsWithExercises = await Promise.all(
          (workoutsData || []).map(async (workout) => {
            const { data: exercisesData } = await supabase
              .from("exercises")
              .select("*")
              .eq("workout_id", workout.id)
              .order("order_index");

            return {
              ...workout,
              workout_type: workout.workout_type as "strength" | "cardio" | "flexibility",
              exercises: exercisesData || [],
            };
          })
        );

        setProgram({
          ...programData,
          workouts: workoutsWithExercises,
        });
      } else {
        setProgram(null);
      }
    } catch (error) {
      console.error("Error fetching workout program:", error);
      // Retry up to 2 times on network failures
      if (retryCount < 2 && error instanceof TypeError && error.message.includes("fetch")) {
        console.log(`Retrying fetch (attempt ${retryCount + 2})...`);
        setTimeout(() => fetchProgram(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      toast.error("Failed to load workout program. Pull down to refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const generateProgram = async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Call the AI to generate workout program
      const response = await supabase.functions.invoke("generate-workout-program", {
        body: { profile },
      });

      if (response.error) throw new Error(response.error.message);

      const generatedProgram = response.data;

      // Deactivate existing programs
      await supabase
        .from("workout_programs")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Save the new program
      const { data: newProgram, error: programInsertError } = await supabase
        .from("workout_programs")
        .insert({
          user_id: user.id,
          name: generatedProgram.program_name,
          description: generatedProgram.program_description,
          week_number: 1,
          is_active: true,
        })
        .select()
        .single();

      if (programInsertError) throw programInsertError;

      // Save workouts and exercises
      const workoutsWithExercises: Workout[] = [];

      for (const workout of generatedProgram.workouts) {
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

        if (workoutInsertError) throw workoutInsertError;

        // Save exercises
        const exercisesToInsert = (workout.exercises || []).map((ex: any, index: number) => ({
          workout_id: newWorkout.id,
          name: ex.name,
          muscle_groups: ex.muscle_groups || null,
          how_to: ex.how_to || null,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds || 60,
          notes: ex.notes,
          order_index: index,
        }));

        const { data: insertedExercises } = await supabase
          .from("exercises")
          .insert(exercisesToInsert)
          .select();

        workoutsWithExercises.push({
          ...newWorkout,
          workout_type: newWorkout.workout_type as "strength" | "cardio" | "flexibility",
          exercises: insertedExercises || [],
        });
      }

      setProgram({
        ...newProgram,
        workouts: workoutsWithExercises,
      });

      toast.success("Workout program generated!");
    } catch (error) {
      console.error("Error generating workout program:", error);
      toast.error("Failed to generate workout program");
    } finally {
      setIsGenerating(false);
    }
  };

  const completeWorkout = async (workoutId: string) => {
    try {
      const { error } = await supabase
        .from("workouts")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", workoutId);

      if (error) throw error;

      // Update local state
      if (program) {
        setProgram({
          ...program,
          workouts: program.workouts.map((w) =>
            w.id === workoutId ? { ...w, is_completed: true } : w
          ),
        });
      }

      toast.success("Workout completed!");
    } catch (error) {
      console.error("Error completing workout:", error);
      toast.error("Failed to complete workout");
    }
  };

  const completeExercise = async (exerciseId: string) => {
    try {
      const { error } = await supabase
        .from("exercises")
        .update({ is_completed: true })
        .eq("id", exerciseId);

      if (error) throw error;

      // Update local state
      if (program) {
        setProgram({
          ...program,
          workouts: program.workouts.map((w) => ({
            ...w,
            exercises: w.exercises.map((e) =>
              e.id === exerciseId ? { ...e, is_completed: true } : e
            ),
          })),
        });
      }
    } catch (error) {
      console.error("Error completing exercise:", error);
    }
  };

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  return {
    program,
    isLoading,
    isGenerating,
    generateProgram,
    completeWorkout,
    completeExercise,
    refetch: fetchProgram,
  };
}
