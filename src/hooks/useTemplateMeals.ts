import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import type { MealTemplate, UserMeal } from "@/types/templates";

export function useTemplateMeals(date: Date = new Date()) {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [userMeals, setUserMeals] = useState<UserMeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");
  const isPremium = tier === "paid";

  // Fetch user's meals for a given date
  const fetchMeals = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date_assigned", dateStr)
        .order("meal_type");

      if (error) throw error;
      setUserMeals((data || []) as unknown as UserMeal[]);
    } catch (error) {
      console.error("Error fetching user meals:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, dateStr]);

  // Generate meal plan from templates
  const generatePlan = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      // Fetch profile for filtering
      const { data: profile } = await supabase
        .from("profiles")
        .select("fitness_goal, daily_calorie_target, dietary_preference, allergies, disliked_foods")
        .eq("id", user.id)
        .single();

      const goalType = mapGoalToTemplateType(profile?.fitness_goal);

      // Fetch matching templates
      const { data: templates, error: tErr } = await supabase
        .from("meal_templates")
        .select("*")
        .eq("goal_type", goalType);

      if (tErr) throw tErr;
      if (!templates || templates.length === 0) {
        toast.error("No meal templates available yet. Check back soon!");
        return;
      }

      // Delete existing user_meals for this date
      await supabase
        .from("user_meals")
        .delete()
        .eq("user_id", user.id)
        .eq("date_assigned", dateStr);

      if (isPremium) {
        // Premium: send templates to edge function for AI personalization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No active session");

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personalize-meal`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ templates, date: dateStr }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Personalization failed");
        }

        // Personalized meals are saved server-side, just refetch
        await fetchMeals();
      } else {
        // Free: use template data directly
        const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
        const selected = selectTemplatesForDay(templates as unknown as MealTemplate[], mealTypes);

        const inserts = selected.map((t) => ({
          user_id: user.id,
          base_template_id: t.id,
          personalized_data: t.data as unknown as Json,
          date_assigned: dateStr,
          meal_type: t.meal_type || "snack",
          total_calories: t.per_serving_calories,
          total_protein: t.per_serving_protein,
          total_carbs: t.per_serving_carbs,
          total_fats: t.per_serving_fats,
        }));

        const { error: insertErr } = await supabase
          .from("user_meals")
          .insert(inserts);

        if (insertErr) throw insertErr;
        await fetchMeals();
      }

      toast.success("Meal plan generated!");
    } catch (error) {
      console.error("Error generating meal plan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate meal plan");
    } finally {
      setIsGenerating(false);
    }
  }, [user, dateStr, isPremium, fetchMeals]);

  // Toggle meal completion
  const toggleComplete = async (mealId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("user_meals")
        .update({ is_completed: completed })
        .eq("id", mealId);

      if (error) throw error;
      setUserMeals((prev) =>
        prev.map((m) => (m.id === mealId ? { ...m, is_completed: completed } : m))
      );
    } catch (error) {
      console.error("Error toggling meal:", error);
      toast.error("Failed to update meal");
    }
  };

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  // Computed totals
  const totalCalories = userMeals.reduce((s, m) => s + (m.total_calories || 0), 0);
  const totalProtein = userMeals.reduce((s, m) => s + (m.total_protein || 0), 0);
  const consumedCalories = userMeals.filter((m) => m.is_completed).reduce((s, m) => s + (m.total_calories || 0), 0);
  const consumedProtein = userMeals.filter((m) => m.is_completed).reduce((s, m) => s + (m.total_protein || 0), 0);

  return {
    userMeals,
    isLoading,
    isGenerating,
    generatePlan,
    toggleComplete,
    refetch: fetchMeals,
    totalCalories,
    totalProtein,
    consumedCalories,
    consumedProtein,
  };
}

// Map profile fitness_goal values to template goal_type values
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

// Pick one template per meal type
function selectTemplatesForDay(templates: MealTemplate[], mealTypes: string[]): MealTemplate[] {
  const selected: MealTemplate[] = [];
  for (const type of mealTypes) {
    const matching = templates.filter((t) => t.meal_type === type);
    if (matching.length > 0) {
      // Random selection for variety
      selected.push(matching[Math.floor(Math.random() * matching.length)]);
    }
  }
  return selected;
}
