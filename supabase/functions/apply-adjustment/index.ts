import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rule-based adjustment logic (applied BEFORE AI regeneration)
interface AdjustmentRule {
  condition: (context: AdjustmentContext) => boolean;
  apply: (context: AdjustmentContext) => AdjustmentResult;
  name: string;
}

interface AdjustmentContext {
  deviations: any[];
  constraints: any;
  checkins: any[];
  currentPlan: any;
}

interface AdjustmentResult {
  newConstraints: any;
  reason: string;
  adjustmentType: string;
}

const adjustmentRules: AdjustmentRule[] = [
  // Rule 1: Reduce workout frequency after repeated skips
  {
    name: 'reduce_workout_frequency',
    condition: (ctx) => {
      const skippedWorkouts = ctx.deviations.filter(
        d => d.deviation_type === 'skipped_workout' && 
        new Date(d.created_at) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      );
      return skippedWorkouts.length >= 3;
    },
    apply: (ctx) => ({
      newConstraints: {
        ...ctx.constraints,
        workouts_per_week: Math.max(2, (ctx.constraints.workouts_per_week || 3) - 1)
      },
      reason: 'Reduced workout frequency due to repeated skipped workouts',
      adjustmentType: 'workout_frequency_reduction'
    })
  },
  
  // Rule 2: Shorten workout duration after time-based skips
  {
    name: 'reduce_workout_duration',
    condition: (ctx) => {
      const timeBasedSkips = ctx.deviations.filter(
        d => d.reason === 'time' && 
        (d.deviation_type === 'skipped_workout' || d.deviation_type === 'shortened_workout')
      );
      return timeBasedSkips.length >= 2;
    },
    apply: (ctx) => ({
      newConstraints: {
        ...ctx.constraints,
        workout_duration_minutes: Math.max(20, (ctx.constraints.workout_duration_minutes || 45) - 15)
      },
      reason: 'Shortened workout duration due to time constraints',
      adjustmentType: 'workout_duration_reduction'
    })
  },
  
  // Rule 3: Budget exceeded - suggest cheaper proteins
  {
    name: 'budget_adjustment',
    condition: (ctx) => {
      const budgetDeviations = ctx.deviations.filter(
        d => d.deviation_type === 'budget_exceeded'
      );
      return budgetDeviations.length >= 1;
    },
    apply: (ctx) => ({
      newConstraints: {
        ...ctx.constraints,
        budget_tier: 'low',
        prefer_cheap_proteins: true
      },
      reason: 'Switched to budget-friendly meal options after budget exceeded',
      adjustmentType: 'budget_tier_reduction'
    })
  },
  
  // Rule 4: Simplify plans after repeated deviations
  {
    name: 'simplify_plans',
    condition: (ctx) => {
      const recentDeviations = ctx.deviations.filter(
        d => new Date(d.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      return recentDeviations.length >= (ctx.constraints.simplify_after_deviations || 3);
    },
    apply: (ctx) => ({
      newConstraints: {
        ...ctx.constraints,
        max_cooking_time_minutes: Math.min(ctx.constraints.max_cooking_time_minutes || 30, 15),
        prefer_simple_meals: true
      },
      reason: 'Simplified meal plans due to repeated deviations',
      adjustmentType: 'plan_simplification'
    })
  },
  
  // Rule 5: Dining out compensation
  {
    name: 'dining_out_compensation',
    condition: (ctx) => {
      const diningOut = ctx.deviations.filter(
        d => d.deviation_type === 'dining_out' && !d.auto_adjusted
      );
      return diningOut.length > 0;
    },
    apply: (ctx) => {
      const uncompensated = ctx.deviations.filter(
        d => d.deviation_type === 'dining_out' && !d.auto_adjusted
      );
      const totalExcessCalories = uncompensated.reduce(
        (sum, d) => sum + (d.impact_calories || 200), 0
      );
      return {
        newConstraints: {
          ...ctx.constraints,
          calorie_deficit_today: totalExcessCalories,
          compensate_meals: uncompensated.map(d => d.id)
        },
        reason: `Compensating for ${uncompensated.length} dining out event(s)`,
        adjustmentType: 'dining_out_compensation'
      };
    }
  }
];

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Service client for admin operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { triggeredBy, planType } = await req.json();

    // Check if user has auto-adjust permission (paid tier)
    const { data: limitCheck } = await userClient.rpc('check_subscription_limit', {
      p_user_id: user.id,
      p_limit_type: 'auto_adjust'
    });

    if (!limitCheck?.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Auto-adjustment requires paid subscription',
        requiresManual: true 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user context
    const [constraintsRes, deviationsRes, checkinsRes] = await Promise.all([
      userClient.from('user_constraints').select('*').eq('user_id', user.id).single(),
      userClient.from('deviation_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      userClient.from('weekly_checkins').select('*').eq('user_id', user.id).order('week_start', { ascending: false }).limit(4)
    ]);

    const constraints = constraintsRes.data || {};
    const deviations = deviationsRes.data || [];
    const checkins = checkinsRes.data || [];

    const context: AdjustmentContext = {
      constraints,
      deviations,
      checkins,
      currentPlan: null
    };

    // Apply rules sequentially, collecting all applicable adjustments
    const appliedAdjustments: AdjustmentResult[] = [];
    let updatedConstraints = { ...constraints };

    for (const rule of adjustmentRules) {
      const ruleContext = { ...context, constraints: updatedConstraints };
      if (rule.condition(ruleContext)) {
        const result = rule.apply(ruleContext);
        appliedAdjustments.push(result);
        updatedConstraints = result.newConstraints;
        
        // Log adjustment to history
        await serviceClient.from('adjustment_history').insert({
          user_id: user.id,
          adjustment_type: result.adjustmentType,
          rule_applied: rule.name,
          before_state: context.constraints,
          after_state: result.newConstraints,
          triggered_by: triggeredBy || 'auto'
        });
      }
    }

    // Update user constraints if any adjustments were made
    if (appliedAdjustments.length > 0) {
      await userClient.from('user_constraints').upsert({
        user_id: user.id,
        ...updatedConstraints,
        updated_at: new Date().toISOString()
      });

      // Mark dining out deviations as adjusted
      const compensatedIds = updatedConstraints.compensate_meals || [];
      if (compensatedIds.length > 0) {
        await serviceClient.from('deviation_events')
          .update({ auto_adjusted: true })
          .in('id', compensatedIds);
      }
    }

    return new Response(JSON.stringify({
      adjustmentsApplied: appliedAdjustments.length,
      adjustments: appliedAdjustments,
      newConstraints: updatedConstraints,
      requiresRegeneration: appliedAdjustments.length > 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in apply-adjustment:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
