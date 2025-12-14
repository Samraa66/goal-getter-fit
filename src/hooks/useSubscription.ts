import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type SubscriptionTier = 'free' | 'paid';

interface SubscriptionLimits {
  allowed: boolean;
  used: number;
  limit: number;
  tier: SubscriptionTier;
}

interface UseSubscriptionReturn {
  tier: SubscriptionTier;
  isLoading: boolean;
  checkLimit: (limitType: 'regeneration' | 'ai_message' | 'auto_adjust' | 'community_write') => Promise<SubscriptionLimits>;
  canRegenerate: boolean;
  canAutoAdjust: boolean;
  regenerationsUsed: number;
  regenerationsLimit: number;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [regenerationsUsed, setRegenerationsUsed] = useState(0);
  const [regenerationsLimit, setRegenerationsLimit] = useState(3);
  const [canRegenerate, setCanRegenerate] = useState(true);
  const [canAutoAdjust, setCanAutoAdjust] = useState(false);

  const checkLimit = useCallback(async (limitType: 'regeneration' | 'ai_message' | 'auto_adjust' | 'community_write'): Promise<SubscriptionLimits> => {
    if (!user) {
      return { allowed: false, used: 0, limit: 0, tier: 'free' };
    }

    const { data, error } = await supabase.functions.invoke('check-limits', {
      body: { limitType }
    });

    if (error) {
      console.error('Error checking limits:', error);
      return { allowed: false, used: 0, limit: 3, tier: 'free' };
    }

    return data as SubscriptionLimits;
  }, [user]);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [regenLimits, autoAdjustLimits] = await Promise.all([
        checkLimit('regeneration'),
        checkLimit('auto_adjust')
      ]);

      setTier(regenLimits.tier);
      setRegenerationsUsed(regenLimits.used);
      setRegenerationsLimit(regenLimits.limit === -1 ? Infinity : regenLimits.limit);
      setCanRegenerate(regenLimits.allowed);
      setCanAutoAdjust(autoAdjustLimits.allowed);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, checkLimit]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    tier,
    isLoading,
    checkLimit,
    canRegenerate,
    canAutoAdjust,
    regenerationsUsed,
    regenerationsLimit,
    refetch: fetchSubscription
  };
}
