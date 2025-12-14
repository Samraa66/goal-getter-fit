import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      deviationType,
      reason,
      relatedWorkoutId,
      relatedMealId,
      notes,
      impactCalories,
      impactProtein,
      impactBudget
    } = await req.json();

    // Validate deviation type
    const validDeviationTypes = ['skipped_workout', 'shortened_workout', 'missed_meal', 'substituted_meal', 'dining_out', 'budget_exceeded'];
    if (!validDeviationTypes.includes(deviationType)) {
      return new Response(JSON.stringify({ error: 'Invalid deviation type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate reason
    const validReasons = ['time', 'budget', 'energy', 'preference', 'dining_out', 'illness', 'other'];
    if (!validReasons.includes(reason)) {
      return new Response(JSON.stringify({ error: 'Invalid reason' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert deviation event
    const { data: deviation, error: deviationError } = await supabase
      .from('deviation_events')
      .insert({
        user_id: user.id,
        deviation_type: deviationType,
        reason: reason,
        related_workout_id: relatedWorkoutId || null,
        related_meal_id: relatedMealId || null,
        notes: notes || null,
        impact_calories: impactCalories || null,
        impact_protein: impactProtein || null,
        impact_budget: impactBudget || null
      })
      .select()
      .single();

    if (deviationError) {
      console.error('Error logging deviation:', deviationError);
      return new Response(JSON.stringify({ error: deviationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if paid user should get auto-adjustment
    const { data: limitCheck } = await supabase.rpc('check_subscription_limit', {
      p_user_id: user.id,
      p_limit_type: 'auto_adjust'
    });

    let adjustmentResult = null;
    
    // For dining out, trigger immediate compensation for paid users
    if (limitCheck?.allowed && deviationType === 'dining_out') {
      const adjustmentResponse = await fetch(
        `${supabaseUrl}/functions/v1/apply-adjustment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            triggeredBy: 'dining_out',
            planType: 'meal'
          })
        }
      );
      
      if (adjustmentResponse.ok) {
        adjustmentResult = await adjustmentResponse.json();
      }
    }

    return new Response(JSON.stringify({
      deviation,
      tier: limitCheck?.tier || 'free',
      adjustmentResult,
      message: limitCheck?.allowed && deviationType === 'dining_out'
        ? 'Deviation logged and meals adjusted automatically'
        : 'Deviation logged successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in log-deviation:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
