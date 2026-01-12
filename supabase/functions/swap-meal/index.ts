import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Deterministic meal type mapping
const MEAL_TYPE_MAP: Record<string, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
  // Common variations
  "morning snack": "snack",
  "afternoon snack": "snack",
  "evening snack": "snack",
  morning_snack: "snack",
  afternoon_snack: "snack",
  evening_snack: "snack",
};

function resolveMealType(input: string): string | null {
  const normalized = input.toLowerCase().trim().replace(/_/g, " ");
  
  // Direct match
  if (MEAL_TYPE_MAP[normalized]) {
    return MEAL_TYPE_MAP[normalized];
  }
  
  // Partial match
  if (normalized.includes("breakfast")) return "breakfast";
  if (normalized.includes("lunch")) return "lunch";
  if (normalized.includes("dinner")) return "dinner";
  if (normalized.includes("snack")) return "snack";
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Authenticate user from JWT
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create client with user's auth context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // SECURITY: Get authenticated user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // RATE LIMITING
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rateLimitResult, error: rateLimitError } = await adminClient.rpc("check_ai_rate_limit", {
      p_user_id: userId,
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log("Rate limit exceeded for user:", userId);
      return new Response(
        JSON.stringify({
          error: rateLimitResult.message || "You've reached today's AI limit. Try again tomorrow.",
          rateLimited: true,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { date, targetMealType, context, reason } = body;

    if (!date) {
      throw new Error("Date is required");
    }

    if (!targetMealType) {
      throw new Error("Target meal type is required");
    }

    // CRITICAL: Resolve meal type deterministically
    const resolvedMealType = resolveMealType(targetMealType);
    if (!resolvedMealType) {
      console.error("Could not resolve meal type:", targetMealType);
      throw new Error(`Unknown meal type: ${targetMealType}`);
    }

    console.log(`Swap Meal: Swapping ${resolvedMealType} for user ${userId} on ${date}`);
    console.log(`Context: ${context}, Reason: ${reason}`);

    // Fetch current meal plan for this date
    const { data: mealPlan, error: planError } = await supabase
      .from("meal_plans")
      .select("id, total_calories, total_protein, total_carbs, total_fats")
      .eq("user_id", userId)
      .eq("plan_date", date)
      .maybeSingle();

    if (planError) {
      console.error("Error fetching meal plan:", planError);
      throw new Error("Could not fetch current meal plan");
    }

    if (!mealPlan) {
      throw new Error("No meal plan found for this date. Please generate a meal plan first.");
    }

    // Fetch all current meals for this plan
    const { data: currentMeals, error: mealsError } = await supabase
      .from("meals")
      .select("*")
      .eq("meal_plan_id", mealPlan.id);

    if (mealsError) {
      console.error("Error fetching meals:", mealsError);
      throw new Error("Could not fetch current meals");
    }

    // Find the specific meal to replace
    const targetMeal = currentMeals?.find((m) => m.meal_type === resolvedMealType);
    if (!targetMeal) {
      throw new Error(`No ${resolvedMealType} found in today's meal plan`);
    }

    console.log(`Found target meal: ${targetMeal.name} (ID: ${targetMeal.id})`);

    // Fetch user profile for nutritional context
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error("Could not fetch user profile");
    }

    // Calculate target macros for this meal (keep similar to original)
    const targetCalories = targetMeal.calories;
    const targetProtein = targetMeal.protein;
    const targetCarbs = targetMeal.carbs;
    const targetFats = targetMeal.fats;

    // Build dietary restrictions
    const dietaryInfo = [];
    if (profile.dietary_preference && profile.dietary_preference !== "none") {
      dietaryInfo.push(`Diet: ${profile.dietary_preference.toUpperCase()}`);
    }
    if (profile.allergies?.length > 0) {
      dietaryInfo.push(`CRITICAL ALLERGIES (NEVER include): ${profile.allergies.join(", ")}`);
    }
    if (profile.disliked_foods?.length > 0) {
      dietaryInfo.push(`Foods to avoid: ${profile.disliked_foods.join(", ")}`);
    }

    // Build specific request context
    const userRequestContext = context
      ? `\nUSER REQUEST: The user specifically asked for: "${context}". Try to incorporate this into the meal if possible while meeting nutritional targets.`
      : "";

    const systemPrompt = `You are an elite sports nutritionist. Generate a SINGLE replacement ${resolvedMealType} meal.

CURRENT MEAL BEING REPLACED:
- Name: ${targetMeal.name}
- Calories: ${targetCalories} kcal
- Protein: ${targetProtein}g
- Carbs: ${targetCarbs}g
- Fats: ${targetFats}g

${dietaryInfo.length > 0 ? "DIETARY REQUIREMENTS:\n" + dietaryInfo.join("\n") : ""}
${userRequestContext}

NUTRITIONAL TARGETS FOR THIS MEAL:
- Calories: ${targetCalories} kcal (±50)
- Protein: ${targetProtein}g (±5g)
- Carbs: ${targetCarbs}g (±10g)
- Fats: ${targetFats}g (±5g)

RULES:
1. Generate a DIFFERENT meal than "${targetMeal.name}"
2. Keep similar nutritional values
3. Respect all dietary restrictions and allergies
4. If user requested specific food, incorporate it

RECIPE FORMAT:
- Each step = ONE sentence
- Format: "1. First action. 2. Second action."

RESPOND WITH ONLY THIS JSON (no markdown):
{"name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"1. Step one. 2. Step two."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a replacement ${resolvedMealType}. Return ONLY valid JSON.` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429 || response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Failed to generate replacement meal");
    }

    // Parse AI response
    let newMeal;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();

      const jsonStart = cleanContent.indexOf("{");
      const jsonEnd = cleanContent.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
      }

      newMeal = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse replacement meal");
    }

    // DATA INTEGRITY: Store original meals for comparison
    const originalMealsSnapshot = currentMeals?.map((m) => ({
      id: m.id,
      meal_type: m.meal_type,
      name: m.name,
    }));

    // SCOPED UPDATE: Only update the targeted meal
    const { error: updateError } = await supabase
      .from("meals")
      .update({
        name: newMeal.name,
        description: newMeal.description,
        calories: newMeal.calories,
        protein: newMeal.protein,
        carbs: newMeal.carbs,
        fats: newMeal.fats,
        recipe: newMeal.recipe,
      })
      .eq("id", targetMeal.id);

    if (updateError) {
      console.error("Failed to update meal:", updateError);
      throw new Error("Failed to save replacement meal");
    }

    // DATA INTEGRITY: Verify only one meal was modified
    const { data: updatedMeals } = await supabase
      .from("meals")
      .select("id, meal_type, name")
      .eq("meal_plan_id", mealPlan.id);

    let changesCount = 0;
    for (const updated of updatedMeals || []) {
      const original = originalMealsSnapshot?.find((o) => o.id === updated.id);
      if (original && original.name !== updated.name) {
        changesCount++;
      }
    }

    if (changesCount > 1) {
      console.error("DATA INTEGRITY ERROR: More than one meal was modified!", changesCount);
      // This should never happen with our scoped update, but log it for monitoring
    }

    console.log(`Swap Meal: Successfully swapped ${resolvedMealType} from "${targetMeal.name}" to "${newMeal.name}"`);

    return new Response(
      JSON.stringify({
        success: true,
        swappedMeal: {
          meal_type: resolvedMealType,
          old_name: targetMeal.name,
          new_name: newMeal.name,
          ...newMeal,
        },
        message: `I updated your ${resolvedMealType}. Let me know if you want to change another meal.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Swap Meal error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
