import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, subDays } from "date-fns";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayComplete: boolean;
  workoutDone: boolean;
  mealsDone: boolean;
}

export function useStreak() {
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    todayComplete: false,
    workoutDone: false,
    mealsDone: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const calculateStreak = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const todayDayOfWeek = today.getDay();

      // Get active workout program
      const { data: workoutProgram } = await supabase
        .from("workout_programs")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      // Check if today has a scheduled workout and if it's completed
      let workoutDone = true; // Default to true if no workout scheduled
      let todayHasWorkout = false;
      
      if (workoutProgram) {
        const { data: todayWorkout } = await supabase
          .from("workouts")
          .select("is_completed, completed_at")
          .eq("program_id", workoutProgram.id)
          .eq("day_of_week", todayDayOfWeek)
          .maybeSingle();

        if (todayWorkout) {
          todayHasWorkout = true;
          // Check if completed TODAY (not just marked complete from a previous week)
          if (todayWorkout.completed_at) {
            const completedDate = format(new Date(todayWorkout.completed_at), "yyyy-MM-dd");
            workoutDone = completedDate === todayStr;
          } else {
            workoutDone = todayWorkout.is_completed === true;
          }
        }
      }

      // Check today's meals completion
      const { data: mealPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("plan_date", todayStr)
        .maybeSingle();

      let mealsDone = false;
      if (mealPlan) {
        const { data: meals } = await supabase
          .from("meals")
          .select("is_completed")
          .eq("meal_plan_id", mealPlan.id);

        // All meals must be completed
        mealsDone = meals && meals.length > 0 && meals.every(m => m.is_completed === true);
      }

      // Today is complete if: (workout done OR no workout scheduled) AND meals done
      const todayComplete = workoutDone && mealsDone;

      // Calculate streak by counting consecutive completed days backwards
      let currentStreak = 0;
      
      // Start checking from today if complete, otherwise from yesterday
      const startOffset = todayComplete ? 0 : 1;

      for (let dayOffset = startOffset; dayOffset < 365; dayOffset++) {
        const checkDate = subDays(today, dayOffset);
        const dateStr = format(checkDate, "yyyy-MM-dd");
        const dayOfWeek = checkDate.getDay();

        let dayComplete = true;

        // Check workout for this day
        if (workoutProgram) {
          const { data: dayWorkout } = await supabase
            .from("workouts")
            .select("is_completed, completed_at")
            .eq("program_id", workoutProgram.id)
            .eq("day_of_week", dayOfWeek)
            .maybeSingle();

          if (dayWorkout) {
            // Must be completed on that specific day
            if (dayWorkout.completed_at) {
              const completedDate = format(new Date(dayWorkout.completed_at), "yyyy-MM-dd");
              if (completedDate !== dateStr) {
                dayComplete = false;
              }
            } else {
              dayComplete = false;
            }
          }
          // If no workout scheduled for that day, it's fine
        }

        // Check meals for this day
        const { data: dayMealPlan } = await supabase
          .from("meal_plans")
          .select("id")
          .eq("user_id", user.id)
          .eq("plan_date", dateStr)
          .maybeSingle();

        if (dayMealPlan) {
          const { data: dayMeals } = await supabase
            .from("meals")
            .select("is_completed")
            .eq("meal_plan_id", dayMealPlan.id);

          if (!dayMeals || dayMeals.length === 0 || !dayMeals.every(m => m.is_completed === true)) {
            dayComplete = false;
          }
        } else {
          // No meal plan for this day - if it's in the past, break streak
          if (dayOffset > 0) {
            dayComplete = false;
          }
        }

        if (dayComplete) {
          currentStreak++;
        } else {
          break;
        }
      }

      setStreakData({
        currentStreak,
        longestStreak: currentStreak, // For now, track current as longest
        todayComplete,
        workoutDone,
        mealsDone,
      });
    } catch (error) {
      console.error("Error calculating streak:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    calculateStreak();
  }, [calculateStreak]);

  return {
    ...streakData,
    isLoading,
    refetch: calculateStreak,
  };
}
