import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";
import { toast } from "sonner";

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

interface MealPlan {
  id: string;
  plan_date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  meals: Meal[];
}

export function useMealPlan(date: Date = new Date()) {
  const { user } = useAuth();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");

  const fetchMealPlan = useCallback(async (retryCount = 0) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch meal plan for the date
      const { data: planData, error: planError } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("plan_date", dateStr)
        .maybeSingle();

      if (planError) throw planError;

      if (planData) {
        // Fetch meals for this plan
        const { data: mealsData, error: mealsError } = await supabase
          .from("meals")
          .select("*")
          .eq("meal_plan_id", planData.id)
          .order("meal_type");

        if (mealsError) throw mealsError;

        setMealPlan({
          ...planData,
          meals: mealsData || [],
        });
      } else {
        setMealPlan(null);
      }
    } catch (error) {
      console.error("Error fetching meal plan:", error);
      // Retry up to 2 times on network failures
      if (retryCount < 2 && error instanceof TypeError && error.message.includes("fetch")) {
        console.log(`Retrying meal plan fetch (attempt ${retryCount + 2})...`);
        setTimeout(() => fetchMealPlan(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      toast.error("Failed to load meal plan. Pull down to refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [user, dateStr]);

  const generateMealPlan = async () => {
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

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session");
      }

      // Call the AI to generate meal plan with proper auth token
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-meal-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ profile, date: dateStr }),
        }
      );

      // Handle rate limiting gracefully
      if (response.status === 429) {
        const errorData = await response.json();
        const waitTime = errorData.error?.match(/(\d+) seconds/)?.[1] || "a few";
        toast.error(`Please wait ${waitTime} seconds before generating again`, {
          description: "Rate limit helps keep the service fast for everyone.",
        });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const generatedPlan = await response.json();

      // Delete existing plan for this date if any
      if (mealPlan) {
        await supabase.from("meals").delete().eq("meal_plan_id", mealPlan.id);
        await supabase.from("meal_plans").delete().eq("id", mealPlan.id);
      }

      // Save the new meal plan
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
      const mealsToInsert = generatedPlan.meals.map((meal: any) => ({
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

      const { data: insertedMeals, error: mealsInsertError } = await supabase
        .from("meals")
        .insert(mealsToInsert)
        .select();

      if (mealsInsertError) throw mealsInsertError;

      setMealPlan({
        ...newPlan,
        meals: insertedMeals,
      });

      toast.success("Meal plan generated!");
    } catch (error) {
      console.error("Error generating meal plan:", error);
      const message = error instanceof Error ? error.message : "Failed to generate meal plan";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleMealComplete = async (mealId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("meals")
        .update({ is_completed: completed })
        .eq("id", mealId);

      if (error) throw error;

      // Update local state
      if (mealPlan) {
        setMealPlan({
          ...mealPlan,
          meals: mealPlan.meals.map((m) =>
            m.id === mealId ? { ...m, is_completed: completed } : m
          ),
        });
      }
    } catch (error) {
      console.error("Error updating meal:", error);
      toast.error("Failed to update meal");
    }
  };

  useEffect(() => {
    fetchMealPlan();
  }, [fetchMealPlan]);

  return {
    mealPlan,
    isLoading,
    isGenerating,
    generateMealPlan,
    toggleMealComplete,
    refetch: fetchMealPlan,
  };
}
