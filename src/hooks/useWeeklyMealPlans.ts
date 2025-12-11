import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, addDays, startOfWeek } from "date-fns";

interface Meal {
  id: string;
  meal_type: string;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  recipe?: string;
  is_completed?: boolean;
}

interface DayMealPlan {
  date: string;
  dayName: string;
  meals: Meal[];
  totalCalories: number;
  totalProtein: number;
}

export function useWeeklyMealPlans() {
  const { user } = useAuth();
  const [weekPlans, setWeekPlans] = useState<DayMealPlan[]>([]);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const fetchWeekPlans = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const today = new Date();
      const weekStart = startOfWeek(today);
      const plans: DayMealPlan[] = [];
      const allMealsTemp: Meal[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dateStr = format(date, "yyyy-MM-dd");

        const { data: planData } = await supabase
          .from("meal_plans")
          .select("*")
          .eq("user_id", user.id)
          .eq("plan_date", dateStr)
          .maybeSingle();

        if (planData) {
          const { data: mealsData } = await supabase
            .from("meals")
            .select("*")
            .eq("meal_plan_id", planData.id)
            .order("meal_type");

          const meals = mealsData || [];
          allMealsTemp.push(...meals);

          plans.push({
            date: dateStr,
            dayName: dayNames[date.getDay()],
            meals,
            totalCalories: planData.total_calories || meals.reduce((sum, m) => sum + (m.calories || 0), 0),
            totalProtein: planData.total_protein || meals.reduce((sum, m) => sum + (m.protein || 0), 0),
          });
        } else {
          plans.push({
            date: dateStr,
            dayName: dayNames[date.getDay()],
            meals: [],
            totalCalories: 0,
            totalProtein: 0,
          });
        }
      }

      setWeekPlans(plans);
      setAllMeals(allMealsTemp);
    } catch (error) {
      console.error("Error fetching weekly meal plans:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWeekPlans();
  }, [fetchWeekPlans]);

  return {
    weekPlans,
    allMeals,
    isLoading,
    refetch: fetchWeekPlans,
  };
}
