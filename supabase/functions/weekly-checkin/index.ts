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
      workoutAdherence, 
      mealAdherence, 
      budgetAdherence, 
      primaryReason, 
      notes 
    } = await req.json();

    // Calculate week start (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Create or update weekly check-in
    const { data: checkin, error: checkinError } = await supabase
      .from('weekly_checkins')
      .upsert({
        user_id: user.id,
        week_start: weekStartStr,
        workout_adherence: workoutAdherence,
        meal_adherence: mealAdherence,
        budget_adherence: budgetAdherence,
        primary_reason: primaryReason,
        notes: notes
      }, {
        onConflict: 'user_id,week_start'
      })
      .select()
      .single();

    if (checkinError) {
      console.error('Error saving checkin:', checkinError);
      return new Response(JSON.stringify({ error: checkinError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is paid and should auto-adjust
    const { data: limitCheck } = await supabase.rpc('check_subscription_limit', {
      p_user_id: user.id,
      p_limit_type: 'auto_adjust'
    });

    let adjustmentResult = null;
    
    if (limitCheck?.allowed) {
      // Trigger adjustment logic for paid users
      const adjustmentResponse = await fetch(
        `${supabaseUrl}/functions/v1/apply-adjustment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            triggeredBy: 'weekly_checkin',
            planType: 'both'
          })
        }
      );
      
      if (adjustmentResponse.ok) {
        adjustmentResult = await adjustmentResponse.json();
        
        // Update checkin with adjustment details
        if (adjustmentResult.adjustmentsApplied > 0) {
          await supabase
            .from('weekly_checkins')
            .update({
              adjustment_applied: true,
              adjustment_details: adjustmentResult
            })
            .eq('id', checkin.id);
        }
      }
    }

    return new Response(JSON.stringify({
      checkin,
      tier: limitCheck?.tier || 'free',
      adjustmentResult,
      message: limitCheck?.allowed 
        ? 'Check-in saved and plans adjusted automatically'
        : 'Check-in saved. Regenerate plans manually to apply changes.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in weekly-checkin:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
