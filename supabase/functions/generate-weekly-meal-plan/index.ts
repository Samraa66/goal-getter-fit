import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── TDEE Calculation ───────────────────────────────────────────────
function calculateTDEE(profile: {
  weight_current: number | null;
  height_cm: number | null;
  age: number | null;
  gender: string | null;
  activity_level: string | null;
  fitness_goal: string | null;
}): number {
  const weight = profile.weight_current || 70;
  const height = profile.height_cm || 170;
  const age = profile.age || 25;
  const gender = profile.gender || "male";

  // Mifflin-St Jeor
  let bmr: number;
  if (gender === "female") {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  }

  // Activity multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };
  const multiplier = activityMultipliers[profile.activity_level || "moderately_active"] || 1.55;
  let tdee = bmr * multiplier;

  // Goal adjustment
  const goal = profile.fitness_goal || "maintain";
  if (goal === "lose_weight" || goal === "weight_loss") {
    tdee -= 500; // ~0.5kg/week deficit
  } else if (goal === "gain_muscle" || goal === "muscle_gain" || goal === "bulk") {
    tdee += 300; // lean surplus
  }

  return Math.round(tdee);
}

// ─── Macro Scaling ──────────────────────────────────────────────────
function scaleTemplate(template: any, targetCalories: number) {
  const templateCalories = template.per_serving_calories || 500;
  if (templateCalories <= 0) return template.data;

  const ratio = targetCalories / templateCalories;
  const data = JSON.parse(JSON.stringify(template.data)); // deep clone

  if (data.ingredients && Array.isArray(data.ingredients)) {
    for (const ing of data.ingredients) {
      ing.grams = Math.round((ing.grams || 0) * ratio);
      ing.calories = Math.round((ing.calories || 0) * ratio);
      ing.protein_g = Math.round(((ing.protein_g || 0) * ratio) * 10) / 10;
      ing.carbs_g = Math.round(((ing.carbs_g || 0) * ratio) * 10) / 10;
      ing.fats_g = Math.round(((ing.fats_g || 0) * ratio) * 10) / 10;
    }
  }

  return data;
}

// ─── Goal Mapping ───────────────────────────────────────────────────
function mapGoalToTemplateType(fitnessGoal: string | null): string {
  const mapping: Record<string, string> = {
    gain_muscle: "bulk",
    lose_weight: "cut",
    improve_fitness: "maintain",
    maintain: "maintain",
    bulk: "bulk",
    muscle_gain: "bulk",
    weight_loss: "cut",
    general_health: "maintain",
    cut: "cut",
  };
  return mapping[fitnessGoal || ""] || "general_health";
}

// ─── Calorie Distribution ───────────────────────────────────────────
const SLOT_DISTRIBUTION: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.40,
};

const MEAL_SLOTS = ["breakfast", "lunch", "dinner"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit check
    const { data: rl } = await adminClient.rpc("check_ai_rate_limit", { p_user_id: user.id });
    if (rl && !rl.allowed) {
      return new Response(JSON.stringify({ error: rl.message, rateLimited: true }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const startDate = body.start_date; // yyyy-MM-dd, defaults to today

    // ─── STEP 1: Fetch profile & calculate TDEE ─────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const dailyCalories = profile?.daily_calorie_target || calculateTDEE(profile || {});
    const goalType = mapGoalToTemplateType(profile?.fitness_goal);

    // ─── STEP 2: Fetch all matching templates ───────────────────────
    const { data: allTemplates, error: tErr } = await supabase
      .from("meal_templates")
      .select("*")
      .eq("goal_type", goalType);

    if (tErr) throw tErr;
    if (!allTemplates || allTemplates.length === 0) {
      return new Response(
        JSON.stringify({ error: "No meal templates available for your goal. Please add templates first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group templates by meal_type
    const templatesByType: Record<string, any[]> = {};
    for (const t of allTemplates) {
      const mt = t.meal_type || "lunch";
      if (!templatesByType[mt]) templatesByType[mt] = [];
      templatesByType[mt].push(t);
    }

    // ─── STEP 3: Calculate start date for 7 days ────────────────────
    const today = startDate || new Date().toISOString().split("T")[0];
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    // ─── STEP 4: Clear existing plan for this week ──────────────────
    // Delete daily meals for these dates
    await adminClient
      .from("user_daily_meals")
      .delete()
      .eq("user_id", user.id)
      .in("date", dates);

    // Delete user_meals that were for these dates (only template-based ones)
    await adminClient
      .from("user_meals")
      .delete()
      .eq("user_id", user.id)
      .in("date_assigned", dates);

    // ─── STEP 5: Allocate meals across 7 days ───────────────────────
    // Track active user_meals with remaining servings per slot
    const activeUserMeals: Record<string, { userMealId: string; remaining: number }> = {};
    const userMealInserts: any[] = [];
    const dailyMealInserts: any[] = [];

    // Template usage tracking to prevent repetition
    const usedTemplateIds: Record<string, Set<string>> = {};
    for (const slot of MEAL_SLOTS) {
      usedTemplateIds[slot] = new Set();
    }

    for (const dateStr of dates) {
      for (const slot of MEAL_SLOTS) {
        const slotCalories = Math.round(dailyCalories * (SLOT_DISTRIBUTION[slot] || 0.33));

        // Check if we have an active meal with remaining servings for this slot
        if (activeUserMeals[slot] && activeUserMeals[slot].remaining > 0) {
          // Use existing meal
          dailyMealInserts.push({
            user_id: user.id,
            date: dateStr,
            meal_slot: slot,
            user_meal_id: activeUserMeals[slot].userMealId,
            servings_used: 1,
          });
          activeUserMeals[slot].remaining -= 1;
          continue;
        }

        // Need a new template for this slot
        const slotTemplates = templatesByType[slot] || templatesByType["lunch"] || [];
        if (slotTemplates.length === 0) continue;

        // Select template avoiding recent repeats
        let selectedTemplate = null;
        const unused = slotTemplates.filter((t: any) => !usedTemplateIds[slot].has(t.id));
        if (unused.length > 0) {
          selectedTemplate = unused[Math.floor(Math.random() * unused.length)];
        } else {
          // All used, reset tracking and pick randomly
          usedTemplateIds[slot].clear();
          selectedTemplate = slotTemplates[Math.floor(Math.random() * slotTemplates.length)];
        }
        usedTemplateIds[slot].add(selectedTemplate.id);

        // Scale macros to match slot calorie target
        const scaledData = scaleTemplate(selectedTemplate, slotCalories);
        const ratio = slotCalories / (selectedTemplate.per_serving_calories || 500);
        const servings = selectedTemplate.servings || 1;

        // Generate a unique ID for the user_meal
        const userMealId = crypto.randomUUID();

        userMealInserts.push({
          id: userMealId,
          user_id: user.id,
          base_template_id: selectedTemplate.id,
          personalized_data: scaledData,
          date_assigned: dateStr,
          meal_type: slot,
          total_servings: servings,
          remaining_servings: servings - 1, // one serving used today
          total_calories: slotCalories,
          total_protein: Math.round((selectedTemplate.per_serving_protein || 0) * ratio * 10) / 10,
          total_carbs: Math.round((selectedTemplate.per_serving_carbs || 0) * ratio * 10) / 10,
          total_fats: Math.round((selectedTemplate.per_serving_fats || 0) * ratio * 10) / 10,
        });

        dailyMealInserts.push({
          user_id: user.id,
          date: dateStr,
          meal_slot: slot,
          user_meal_id: userMealId,
          servings_used: 1,
        });

        // Track remaining servings for multi-serving meals
        if (servings > 1) {
          activeUserMeals[slot] = {
            userMealId,
            remaining: servings - 1,
          };
        } else {
          delete activeUserMeals[slot];
        }
      }
    }

    // ─── STEP 6: Batch insert ───────────────────────────────────────
    if (userMealInserts.length > 0) {
      const { error: umErr } = await adminClient
        .from("user_meals")
        .insert(userMealInserts);
      if (umErr) {
        console.error("user_meals insert error:", umErr);
        throw new Error("Failed to save meal plan");
      }
    }

    if (dailyMealInserts.length > 0) {
      const { error: dmErr } = await adminClient
        .from("user_daily_meals")
        .insert(dailyMealInserts);
      if (dmErr) {
        console.error("user_daily_meals insert error:", dmErr);
        throw new Error("Failed to save daily meal schedule");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        daily_calories: dailyCalories,
        days_planned: dates.length,
        meals_created: userMealInserts.length,
        daily_slots_filled: dailyMealInserts.length,
        start_date: dates[0],
        end_date: dates[dates.length - 1],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate Weekly Meal Plan error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Something went wrong" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
