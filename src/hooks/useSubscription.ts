import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type SubscriptionTier = 'free' | 'paid';

interface SubscriptionState {
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: string | null;
  productId: string | null;
}

interface UsageState {
  messagesUsed: number;
  messagesLimit: number;
  canSendMessage: boolean;
}

interface UseSubscriptionReturn {
  // Subscription state
  tier: SubscriptionTier;
  isPro: boolean;
  isLoading: boolean;
  subscriptionEnd: string | null;
  
  // Usage limits
  messagesUsed: number;
  messagesLimit: number;
  canSendMessage: boolean;
  
  // Actions
  checkSubscription: () => Promise<void>;
  checkMessageLimit: () => Promise<boolean>;
  incrementMessageCount: () => void;
  openCustomerPortal: () => Promise<void>;
  openCheckout: () => Promise<void>;
}

// Free tier limits
const FREE_DAILY_MESSAGE_LIMIT = 10;
const FREE_HISTORY_LIMIT = 20; // Messages to keep in context

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    tier: 'free',
    subscribed: false,
    subscriptionEnd: null,
    productId: null,
  });
  const [usage, setUsage] = useState<UsageState>({
    messagesUsed: 0,
    messagesLimit: FREE_DAILY_MESSAGE_LIMIT,
    canSendMessage: true,
  });

  // Check Stripe subscription status
  const checkSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-stripe-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      if (data) {
        setSubscription({
          tier: data.tier || 'free',
          subscribed: data.subscribed || false,
          subscriptionEnd: data.subscription_end || null,
          productId: data.product_id || null,
        });

        // Pro users have unlimited messages
        if (data.tier === 'paid') {
          setUsage(prev => ({
            ...prev,
            messagesLimit: Infinity,
            canSendMessage: true,
          }));
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check daily message limit (uses existing rate limit function)
  const checkMessageLimit = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    // Pro users bypass limits
    if (subscription.tier === 'paid') {
      return true;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-limits', {
        body: { limitType: 'ai_message' }
      });

      if (error) {
        console.error('Error checking message limit:', error);
        return false;
      }

      const allowed = data?.allowed ?? false;
      const used = data?.used ?? 0;
      const limit = data?.limit ?? FREE_DAILY_MESSAGE_LIMIT;

      setUsage({
        messagesUsed: used,
        messagesLimit: limit === -1 ? Infinity : limit,
        canSendMessage: allowed,
      });

      return allowed;
    } catch (error) {
      console.error('Error checking message limit:', error);
      return false;
    }
  }, [user, subscription.tier]);

  // Increment local message count (optimistic update)
  const incrementMessageCount = useCallback(() => {
    if (subscription.tier === 'paid') return;
    
    setUsage(prev => {
      const newUsed = prev.messagesUsed + 1;
      return {
        ...prev,
        messagesUsed: newUsed,
        canSendMessage: newUsed < prev.messagesLimit,
      };
    });
  }, [subscription.tier]);

  // Open Stripe customer portal
  const openCustomerPortal = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        console.error('Error opening customer portal:', error);
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
    }
  }, [user]);

  // Open Stripe checkout
  const openCheckout = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) {
        console.error('Error creating checkout:', error);
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
    }
  }, [user]);

  // Check subscription on mount and after auth changes
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Check for subscription success in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      // Re-check subscription after successful checkout
      setTimeout(() => {
        checkSubscription();
      }, 2000);
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [checkSubscription]);

  // Periodic subscription check (every 60 seconds)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return {
    // Subscription state
    tier: subscription.tier,
    isPro: subscription.tier === 'paid',
    isLoading,
    subscriptionEnd: subscription.subscriptionEnd,
    
    // Usage limits
    messagesUsed: usage.messagesUsed,
    messagesLimit: usage.messagesLimit,
    canSendMessage: usage.canSendMessage,
    
    // Actions
    checkSubscription,
    checkMessageLimit,
    incrementMessageCount,
    openCustomerPortal,
    openCheckout,
  };
}

// Export limits for use elsewhere
export const SUBSCRIPTION_LIMITS = {
  FREE_DAILY_MESSAGE_LIMIT,
  FREE_HISTORY_LIMIT,
};
