import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export type AdherenceLevel = 'yes' | 'partial' | 'no';
export type CheckinReason = 'time' | 'budget' | 'energy' | 'preference' | 'dining_out' | 'illness' | 'other';

interface CheckinParams {
  workoutAdherence: AdherenceLevel;
  mealAdherence: AdherenceLevel;
  budgetAdherence: AdherenceLevel;
  primaryReason?: CheckinReason;
  notes?: string;
}

interface CheckinResult {
  checkin: any;
  tier: string;
  adjustmentResult: any | null;
  message: string;
}

export function useWeeklyCheckin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitCheckin = useCallback(async (params: CheckinParams): Promise<CheckinResult | null> => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to submit a check-in",
        variant: "destructive"
      });
      return null;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-checkin', {
        body: params
      });

      if (error) {
        throw new Error(error.message);
      }

      supabase.functions
        .invoke("log-user-signal", {
          body: { signal_type: "checkin_submitted", payload: params },
        })
        .catch(() => {});

      // Show appropriate toast based on tier and result
      if (data.adjustmentResult?.adjustmentsApplied > 0) {
        toast({
          title: "Check-in Complete",
          description: `Your plans have been automatically adjusted based on your feedback.`,
        });
      } else if (data.tier === 'free') {
        toast({
          title: "Check-in Saved",
          description: "Regenerate your plans to apply changes based on your feedback.",
        });
      } else {
        toast({
          title: "Check-in Complete",
          description: data.message,
        });
      }

      return data as CheckinResult;
    } catch (error) {
      console.error('Error submitting check-in:', error);
      toast({
        title: "Error",
        description: "Failed to submit check-in",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, toast]);

  return {
    isSubmitting,
    submitCheckin
  };
}
