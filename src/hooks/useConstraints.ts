import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserConstraints {
  id?: string;
  user_id?: string;
  // Fitness constraints
  workouts_per_week: number;
  workout_duration_minutes: number;
  equipment_access: string[];
  preferred_workout_days: number[];
  // Nutrition constraints
  weekly_food_budget: number;
  meals_per_day: number;
  max_cooking_time_minutes: number;
  protein_target_grams: number | null;
  // Preferences
  simplify_after_deviations: number;
}

const DEFAULT_CONSTRAINTS: UserConstraints = {
  workouts_per_week: 3,
  workout_duration_minutes: 45,
  equipment_access: ['bodyweight'],
  preferred_workout_days: [1, 3, 5],
  weekly_food_budget: 100,
  meals_per_day: 3,
  max_cooking_time_minutes: 30,
  protein_target_grams: null,
  simplify_after_deviations: 3
};

export function useConstraints() {
  const { user } = useAuth();
  const [constraints, setConstraints] = useState<UserConstraints>(DEFAULT_CONSTRAINTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConstraints = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_constraints')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching constraints:', error);
      }

      if (data) {
        setConstraints(data as UserConstraints);
      }
    } catch (error) {
      console.error('Error fetching constraints:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateConstraints = useCallback(async (updates: Partial<UserConstraints>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('user_constraints')
      .upsert({
        user_id: user.id,
        ...constraints,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating constraints:', error);
      return { error };
    }

    setConstraints(data as UserConstraints);
    return { data };
  }, [user, constraints]);

  useEffect(() => {
    fetchConstraints();
  }, [fetchConstraints]);

  return {
    constraints,
    isLoading,
    updateConstraints,
    refetch: fetchConstraints
  };
}
