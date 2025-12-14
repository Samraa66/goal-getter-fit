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

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Fetch all relevant data in parallel
    const [
      constraintsRes,
      subscriptionRes,
      todayMealPlanRes,
      todayWorkoutRes,
      weeklyMealPlansRes,
      recentDeviationsRes,
      lastAdjustmentRes,
      profileRes
    ] = await Promise.all([
      supabase.from('user_constraints').select('*').eq('user_id', user.id).single(),
      supabase.rpc('check_subscription_limit', { p_user_id: user.id, p_limit_type: 'regeneration' }),
      supabase.from('meal_plans').select('*, meals(*)').eq('user_id', user.id).eq('plan_date', today).single(),
      supabase.from('workout_programs').select('*, workouts(*, exercises(*))').eq('user_id', user.id).eq('is_active', true).single(),
      supabase.from('meal_plans').select('estimated_weekly_cost').eq('user_id', user.id).gte('plan_date', weekStartStr),
      supabase.from('deviation_events').select('*').eq('user_id', user.id).gte('created_at', weekStartStr).order('created_at', { ascending: false }),
      supabase.from('adjustment_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('profiles').select('*').eq('id', user.id).single()
    ]);

    const constraints = constraintsRes.data;
    const subscription = subscriptionRes.data;
    const todayMealPlan = todayMealPlanRes.data;
    const workoutProgram = todayWorkoutRes.data;
    const weeklyMealPlans = weeklyMealPlansRes.data || [];
    const recentDeviations = recentDeviationsRes.data || [];
    const lastAdjustment = lastAdjustmentRes.data?.[0];
    const profile = profileRes.data;

    // Calculate plan status
    const deviationCount = recentDeviations.length;
    let planStatus = 'on_track';
    if (deviationCount >= 3) {
      planStatus = 'needs_review';
    } else if (deviationCount > 0) {
      planStatus = 'minor_deviations';
    }
    if (lastAdjustment && new Date(lastAdjustment.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      planStatus = 'recently_adjusted';
    }

    // Calculate budget usage
    const weeklyBudget = constraints?.weekly_food_budget || 100;
    const estimatedWeeklyCost = weeklyMealPlans.reduce(
      (sum: number, plan: any) => sum + (plan.estimated_weekly_cost || 0), 0
    ) / Math.max(weeklyMealPlans.length, 1) * 7;
    const budgetUsagePercent = Math.round((estimatedWeeklyCost / weeklyBudget) * 100);

    // Get today's workout
    const dayOfWeek = new Date().getDay();
    const todayWorkout = workoutProgram?.workouts?.find(
      (w: any) => w.day_of_week === dayOfWeek && !w.is_completed
    );

    // Get upcoming meals
    const upcomingMeals = todayMealPlan?.meals?.filter((m: any) => !m.is_completed) || [];

    // Format last adjustment summary
    let lastAdjustmentSummary = null;
    if (lastAdjustment) {
      lastAdjustmentSummary = {
        type: lastAdjustment.adjustment_type,
        reason: lastAdjustment.rule_applied,
        date: lastAdjustment.created_at,
        triggeredBy: lastAdjustment.triggered_by
      };
    }

    return new Response(JSON.stringify({
      user: {
        name: profile?.full_name || 'User',
        tier: subscription?.tier || 'free'
      },
      planStatus: {
        status: planStatus,
        deviationsThisWeek: deviationCount,
        message: getStatusMessage(planStatus, deviationCount)
      },
      budget: {
        weeklyBudget,
        estimatedWeeklyCost: Math.round(estimatedWeeklyCost),
        usagePercent: budgetUsagePercent,
        status: budgetUsagePercent > 100 ? 'over_budget' : budgetUsagePercent > 80 ? 'near_limit' : 'on_track'
      },
      today: {
        workout: todayWorkout ? {
          id: todayWorkout.id,
          name: todayWorkout.name,
          type: todayWorkout.workout_type,
          duration: todayWorkout.duration_minutes,
          exerciseCount: todayWorkout.exercises?.length || 0
        } : null,
        meals: upcomingMeals.map((m: any) => ({
          id: m.id,
          name: m.name,
          type: m.meal_type,
          calories: m.calories,
          protein: m.protein
        })),
        totalCalories: todayMealPlan?.total_calories || 0,
        totalProtein: todayMealPlan?.total_protein || 0
      },
      lastAdjustment: lastAdjustmentSummary,
      limits: {
        regenerationsUsed: subscription?.used || 0,
        regenerationsLimit: subscription?.limit || 3,
        canRegenerate: subscription?.allowed || false
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in home-summary:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getStatusMessage(status: string, deviationCount: number): string {
  switch (status) {
    case 'on_track':
      return "You're doing great! Keep it up.";
    case 'minor_deviations':
      return `${deviationCount} deviation${deviationCount > 1 ? 's' : ''} this week. No worries, stay flexible.`;
    case 'needs_review':
      return "Multiple deviations detected. Consider reviewing your plan.";
    case 'recently_adjusted':
      return "Your plan was recently adjusted based on your progress.";
    default:
      return "Keep going!";
  }
}
