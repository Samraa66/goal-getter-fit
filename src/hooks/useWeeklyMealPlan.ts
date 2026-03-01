import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import type { UserMeal, UserDailyMeal } from "@/types/templates";

export function useWeeklyMealPlan() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<
    Record<string, { slot: string; userMeal: UserMeal; servingsUsed: number }[]>
  >({});

  // Generate a new 7-day meal plan
  const generateWeeklyPlan = useCallback(
    async (startDate?: string) => {
      if (!user) return;
      setIsGenerating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No active session");

        const idempotencyKey = crypto.randomUUID();
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-weekly-meal-plan`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              start_date: startDate,
              idempotency_key: idempotencyKey,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          if (response.status === 429) {
            toast.error("Rate limit", {
              description: err.message || "Please wait a moment before generating again.",
            });
            return;
          }
          if (response.status === 402) {
            toast.error("Limit reached", {
              description: err.message || "Upgrade for more generations.",
            });
            return;
          }
          throw new Error(err.error || "Failed to generate weekly meal plan");
        }

        const result = await response.json();
        toast.success(
          result.from_cache
            ? "Weekly meal plan loaded."
            : `Weekly meal plan created! ${result.meals_created} meals across ${result.days_planned} days.`
        );

        // Refetch the plan
        await fetchWeeklyPlan(startDate);
        return result;
      } catch (error) {
        console.error("Error generating weekly meal plan:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to generate meal plan"
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [user]
  );

  // Fetch the weekly plan (daily meals joined with user_meals)
  const fetchWeeklyPlan = useCallback(
    async (startDate?: string) => {
      if (!user) return;
      setIsLoading(true);
      try {
        const start = startDate || format(new Date(), "yyyy-MM-dd");
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
          dates.push(format(addDays(new Date(start), i), "yyyy-MM-dd"));
        }

        // Fetch daily meals for this week
        const { data: dailyMeals, error: dmErr } = await supabase
          .from("user_daily_meals")
          .select("*")
          .eq("user_id", user.id)
          .in("date", dates)
          .order("date")
          .order("meal_slot");

        if (dmErr) throw dmErr;

        if (!dailyMeals || dailyMeals.length === 0) {
          setWeeklyPlan({});
          return;
        }

        // Fetch related user_meals
        const userMealIds = [
          ...new Set((dailyMeals as any[]).map((dm) => dm.user_meal_id)),
        ];
        const { data: userMeals, error: umErr } = await supabase
          .from("user_meals")
          .select("*")
          .in("id", userMealIds);

        if (umErr) throw umErr;

        const mealsMap = new Map<string, UserMeal>();
        for (const um of (userMeals || []) as unknown as UserMeal[]) {
          mealsMap.set(um.id, um);
        }

        // Group by date
        const plan: Record<
          string,
          { slot: string; userMeal: UserMeal; servingsUsed: number }[]
        > = {};
        for (const dm of dailyMeals as unknown as UserDailyMeal[]) {
          const meal = mealsMap.get(dm.user_meal_id);
          if (!meal) continue;
          if (!plan[dm.date]) plan[dm.date] = [];
          plan[dm.date].push({
            slot: dm.meal_slot,
            userMeal: meal,
            servingsUsed: dm.servings_used,
          });
        }

        setWeeklyPlan(plan);
      } catch (error) {
        console.error("Error fetching weekly meal plan:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  return {
    weeklyPlan,
    isGenerating,
    isLoading,
    generateWeeklyPlan,
    fetchWeeklyPlan,
  };
}
