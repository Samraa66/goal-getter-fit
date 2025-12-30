import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, addDays, startOfWeek } from "date-fns";
import { toast } from "sonner";

interface Meal {
  id?: string;
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

interface DayPlan {
  date: string;
  meals: Meal[];
  total_calories: number;
  total_protein: number;
}

export function useWeeklyMealGeneration() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateWeeklyMealPlan = useCallback(async () => {
    if (!user) return null;

    setIsGenerating(true);
    setProgress(0);

    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const today = new Date();
      const weekStart = startOfWeek(today);
      const weekPlans: DayPlan[] = [];

      // Delete existing meal plans for the week first
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dateStr = format(date, "yyyy-MM-dd");

        const { data: existingPlan } = await supabase
          .from("meal_plans")
          .select("id")
          .eq("user_id", user.id)
          .eq("plan_date", dateStr)
          .maybeSingle();

        if (existingPlan) {
          await supabase.from("meals").delete().eq("meal_plan_id", existingPlan.id);
          await supabase.from("meal_plans").delete().eq("id", existingPlan.id);
        }
      }

      // Generate meals for each day of the week
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dateStr = format(date, "yyyy-MM-dd");
        setProgress(Math.round(((i + 1) / 7) * 100));

        try {
          // Call AI to generate meal plan for this day
          const response = await supabase.functions.invoke("generate-meal-plan", {
            body: { profile, date: dateStr },
          });

          if (response.error) {
            console.error(`Error generating plan for ${dateStr}:`, response.error);
            continue;
          }

          const generatedPlan = response.data;

          // Save the meal plan
          const { data: newPlan, error: planInsertError } = await supabase
            .from("meal_plans")
            .insert({
              user_id: user.id,
              plan_date: dateStr,
              total_calories: generatedPlan.total_calories,
              total_protein: generatedPlan.total_protein,
              total_carbs: generatedPlan.total_carbs,
              total_fats: generatedPlan.total_fats,
            })
            .select()
            .single();

          if (planInsertError) throw planInsertError;

          // Save meals
          const mealsToInsert = generatedPlan.meals.map((meal: Meal) => ({
            meal_plan_id: newPlan.id,
            meal_type: meal.meal_type,
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fats: meal.fats,
            recipe: meal.recipe,
          }));

          const { data: insertedMeals } = await supabase
            .from("meals")
            .insert(mealsToInsert)
            .select();

          weekPlans.push({
            date: dateStr,
            meals: insertedMeals || [],
            total_calories: generatedPlan.total_calories,
            total_protein: generatedPlan.total_protein,
          });

        } catch (dayError) {
          console.error(`Failed to generate plan for ${dateStr}:`, dayError);
        }
      }

      toast.success(`Generated meal plans for ${weekPlans.length} days!`);
      return weekPlans;
    } catch (error) {
      console.error("Error generating weekly meal plan:", error);
      toast.error("Failed to generate weekly meal plan");
      return null;
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [user]);

  return {
    generateWeeklyMealPlan,
    isGenerating,
    progress,
  };
}
