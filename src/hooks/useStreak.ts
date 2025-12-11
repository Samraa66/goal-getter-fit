import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, subDays, isSameDay } from "date-fns";

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

      // Check today's workout completion
      const { data: workoutProgram } = await supabase
        .from("workout_programs")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      let workoutDone = false;
      if (workoutProgram) {
        const { data: todayWorkout } = await supabase
          .from("workouts")
          .select("is_completed")
          .eq("program_id", workoutProgram.id)
          .eq("day_of_week", todayDayOfWeek)
          .maybeSingle();

        // If no workout scheduled for today, consider it done
        workoutDone = !todayWorkout || todayWorkout.is_completed === true;
      } else {
        workoutDone = true; // No program = workout not required
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

      const todayComplete = workoutDone && mealsDone;

      // Calculate streak by going back through days
      let currentStreak = todayComplete ? 1 : 0;
      let checkDate = todayComplete ? subDays(today, 1) : subDays(today, 0);
      
      // If today isn't complete but yesterday was, still count from yesterday
      if (!todayComplete) {
        checkDate = subDays(today, 1);
      }

      // Check previous days for streak
      for (let i = 0; i < 365; i++) {
        const dateStr = format(checkDate, "yyyy-MM-dd");
        const dayOfWeek = checkDate.getDay();

        // Check workout for this day
        let dayWorkoutDone = true;
        if (workoutProgram) {
          const { data: dayWorkout } = await supabase
            .from("workouts")
            .select("is_completed, completed_at")
            .eq("program_id", workoutProgram.id)
            .eq("day_of_week", dayOfWeek)
            .maybeSingle();

          if (dayWorkout) {
            // Check if completed on that specific day
            if (dayWorkout.completed_at) {
              const completedDate = new Date(dayWorkout.completed_at);
              dayWorkoutDone = isSameDay(completedDate, checkDate) || 
                              (completedDate <= checkDate && dayWorkout.is_completed);
            } else {
              dayWorkoutDone = false;
            }
          }
        }

        // Check meals for this day
        const { data: dayMealPlan } = await supabase
          .from("meal_plans")
          .select("id")
          .eq("user_id", user.id)
          .eq("plan_date", dateStr)
          .maybeSingle();

        let dayMealsDone = false;
        if (dayMealPlan) {
          const { data: dayMeals } = await supabase
            .from("meals")
            .select("is_completed")
            .eq("meal_plan_id", dayMealPlan.id);

          dayMealsDone = dayMeals && dayMeals.length > 0 && dayMeals.every(m => m.is_completed === true);
        }

        if (dayWorkoutDone && dayMealsDone) {
          if (!todayComplete && i === 0) {
            // Yesterday was complete, start counting
            currentStreak = 1;
          } else {
            currentStreak++;
          }
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }

      setStreakData({
        currentStreak,
        longestStreak: currentStreak, // For now, just use current as longest
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
