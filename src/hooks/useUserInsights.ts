import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserInsights {
  id: string;
  preferred_meal_times: Record<string, string>;
  avoided_foods: string[];
  favorite_cuisines: string[];
  workout_consistency_score: number;
  avg_calories_consumed: number;
  hydration_consistency: number;
  most_skipped_meal_type: string | null;
  most_completed_workout_type: string | null;
  energy_pattern: string | null;
  template_affinity: Record<string, number>;
  last_updated: string;
}

export function useUserInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<UserInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!user) {
      setInsights(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("user_insights")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      setInsights(data as UserInsights | null);
    } catch (err) {
      console.error("Error fetching user insights:", err);
      setError(err instanceof Error ? err.message : "Failed to load insights");
      setInsights(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    isLoading,
    error,
    refetch: fetchInsights,
  };
}
