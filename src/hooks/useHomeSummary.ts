import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface PlanStatus {
  status: 'on_track' | 'minor_deviations' | 'needs_review' | 'recently_adjusted';
  deviationsThisWeek: number;
  message: string;
}

interface BudgetStatus {
  weeklyBudget: number;
  estimatedWeeklyCost: number;
  usagePercent: number;
  status: 'on_track' | 'near_limit' | 'over_budget';
}

interface TodayWorkout {
  id: string;
  name: string;
  type: string;
  duration: number;
  exerciseCount: number;
}

interface TodayMeal {
  id: string;
  name: string;
  type: string;
  calories: number;
  protein: number;
}

interface LastAdjustment {
  type: string;
  reason: string;
  date: string;
  triggeredBy: string;
}

interface HomeSummary {
  user: {
    name: string;
    tier: 'free' | 'paid';
  };
  planStatus: PlanStatus;
  budget: BudgetStatus;
  today: {
    workout: TodayWorkout | null;
    meals: TodayMeal[];
    totalCalories: number;
    totalProtein: number;
  };
  lastAdjustment: LastAdjustment | null;
  limits: {
    regenerationsUsed: number;
    regenerationsLimit: number;
    canRegenerate: boolean;
  };
}

export function useHomeSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('home-summary');

      if (fnError) {
        throw new Error(fnError.message);
      }

      setSummary(data as HomeSummary);
    } catch (err) {
      console.error('Error fetching home summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    isLoading,
    error,
    refetch: fetchSummary
  };
}
