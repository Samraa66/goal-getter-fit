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

      // Check today's workout from user_workouts
      const { data: todayWorkout } = await supabase
        .from("user_workouts")
        .select("is_completed")
        .eq("user_id", user.id)
        .eq("date_assigned", todayStr)
        .maybeSingle();

      // If no workout scheduled today, count as done
      const workoutDone = !todayWorkout || todayWorkout.is_completed === true;

      // Check today's meals from user_meals
      const { data: todayMeals } = await supabase
        .from("user_meals")
        .select("is_completed")
        .eq("user_id", user.id)
        .eq("date_assigned", todayStr);

      const mealsDone = todayMeals && todayMeals.length > 0 && todayMeals.every(m => m.is_completed === true);

      const todayComplete = workoutDone && !!mealsDone;

      // Calculate streak backwards
      let currentStreak = 0;
      const startOffset = todayComplete ? 0 : 1;

      for (let dayOffset = startOffset; dayOffset < 90; dayOffset++) {
        const checkDate = subDays(today, dayOffset);
        const dateStr = format(checkDate, "yyyy-MM-dd");
        let dayComplete = true;

        // Check workout
        const { data: dayWorkout } = await supabase
          .from("user_workouts")
          .select("is_completed")
          .eq("user_id", user.id)
          .eq("date_assigned", dateStr)
          .maybeSingle();

        if (dayWorkout && !dayWorkout.is_completed) {
          dayComplete = false;
        }

        // Check meals
        const { data: dayMeals } = await supabase
          .from("user_meals")
          .select("is_completed")
          .eq("user_id", user.id)
          .eq("date_assigned", dateStr);

        if (!dayMeals || dayMeals.length === 0) {
          if (dayOffset > 0) dayComplete = false;
        } else if (!dayMeals.every(m => m.is_completed === true)) {
          dayComplete = false;
        }

        if (dayComplete) {
          currentStreak++;
        } else {
          break;
        }
      }

      setStreakData({
        currentStreak,
        longestStreak: currentStreak,
        todayComplete,
        workoutDone,
        mealsDone: !!mealsDone,
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
