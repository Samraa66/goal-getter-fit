import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export type DeviationType = 
  | 'skipped_workout' 
  | 'shortened_workout' 
  | 'missed_meal' 
  | 'substituted_meal' 
  | 'dining_out' 
  | 'budget_exceeded';

export type DeviationReason = 
  | 'time' 
  | 'budget' 
  | 'energy' 
  | 'preference' 
  | 'dining_out' 
  | 'illness' 
  | 'other';

interface LogDeviationParams {
  deviationType: DeviationType;
  reason: DeviationReason;
  relatedWorkoutId?: string;
  relatedMealId?: string;
  notes?: string;
  impactCalories?: number;
  impactProtein?: number;
  impactBudget?: number;
}

interface DeviationResult {
  deviation: any;
  tier: string;
  adjustmentResult: any | null;
  message: string;
}

export function useDeviations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLogging, setIsLogging] = useState(false);

  const logDeviation = useCallback(async (params: LogDeviationParams): Promise<DeviationResult | null> => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to log deviations",
        variant: "destructive"
      });
      return null;
    }

    setIsLogging(true);
    try {
      const { data, error } = await supabase.functions.invoke('log-deviation', {
        body: params
      });

      if (error) {
        throw new Error(error.message);
      }

      // Show appropriate toast based on result
      if (data.adjustmentResult?.adjustmentsApplied > 0) {
        toast({
          title: "Plan Adjusted",
          description: data.message,
        });
      } else {
        toast({
          title: "Deviation Logged",
          description: data.message,
        });
      }

      return data as DeviationResult;
    } catch (error) {
      console.error('Error logging deviation:', error);
      toast({
        title: "Error",
        description: "Failed to log deviation",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLogging(false);
    }
  }, [user, toast]);

  const logSkippedWorkout = useCallback((workoutId: string, reason: DeviationReason, notes?: string) => {
    return logDeviation({
      deviationType: 'skipped_workout',
      reason,
      relatedWorkoutId: workoutId,
      notes
    });
  }, [logDeviation]);

  const logMissedMeal = useCallback((mealId: string, reason: DeviationReason, notes?: string) => {
    return logDeviation({
      deviationType: 'missed_meal',
      reason,
      relatedMealId: mealId,
      notes
    });
  }, [logDeviation]);

  const logDiningOut = useCallback((
    mealId: string, 
    estimatedCalories: number, 
    estimatedProtein: number, 
    estimatedCost: number,
    notes?: string
  ) => {
    return logDeviation({
      deviationType: 'dining_out',
      reason: 'dining_out',
      relatedMealId: mealId,
      impactCalories: estimatedCalories,
      impactProtein: estimatedProtein,
      impactBudget: estimatedCost,
      notes
    });
  }, [logDeviation]);

  return {
    isLogging,
    logDeviation,
    logSkippedWorkout,
    logMissedMeal,
    logDiningOut
  };
}
