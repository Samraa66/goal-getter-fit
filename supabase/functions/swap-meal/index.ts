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
  "morning snack": "snack",
  "afternoon snack": "snack",
  "evening snack": "snack",
  morning_snack: "snack",
  afternoon_snack: "snack",
  evening_snack: "snack",
};

function resolveMealType(input: string): string | null {
  const normalized = input.toLowerCase().trim().replace(/_/g, " ");
  if (MEAL_TYPE_MAP[normalized]) return MEAL_TYPE_MAP[normalized];
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

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const userId = user.id;

    // Rate limiting
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rateLimitResult } = await adminClient.rpc("check_ai_rate_limit", { p_user_id: userId });
    if (rateLimitResult && !rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ error: rateLimitResult.message || "Rate limit reached.", rateLimited: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { date, targetMealType, context, reason } = await req.json();
    if (!date) throw new Error("Date is required");
    if (!targetMealType) throw new Error("Target meal type is required");

    const resolvedMealType = resolveMealType(targetMealType);
    if (!resolvedMealType) throw new Error(`Unknown meal type: ${targetMealType}`);

    console.log(`Swap Meal: Swapping ${resolvedMealType} for user ${userId} on ${date}`);

    // Find the user_meal to replace (Template-First schema)
    const { data: targetMeal, error: mealError } = await supabase
      .from("user_meals")
      .select("*")
      .eq("user_id", userId)
      .eq("date_assigned", date)
      .eq("meal_type", resolvedMealType)
      .maybeSingle();

    if (mealError) throw new Error("Could not fetch current meal");
    if (!targetMeal) throw new Error(`No ${resolvedMealType} found for ${date}. Generate a meal plan first.`);

    const currentData = targetMeal.personalized_data as any;
    console.log(`Found target meal: ${currentData?.meal_name} (ID: ${targetMeal.id})`);

    // Fetch user profile for dietary context
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!profile) throw new Error("Could not fetch user profile");

    // Build dietary restrictions
    const dietaryInfo: string[] = [];
    if (profile.dietary_preference && profile.dietary_preference !== "none") {
      dietaryInfo.push(`Diet: ${profile.dietary_preference.toUpperCase()}`);
    }
    if (profile.allergies?.length > 0) {
      dietaryInfo.push(`CRITICAL ALLERGIES (NEVER include): ${profile.allergies.join(", ")}`);
    }
    if (profile.disliked_foods?.length > 0) {
      dietaryInfo.push(`Foods to avoid: ${profile.disliked_foods.join(", ")}`);
    }

    const targetCalories = targetMeal.total_calories || 500;
    const targetProtein = targetMeal.total_protein || 30;
    const targetCarbs = targetMeal.total_carbs || 50;
    const targetFats = targetMeal.total_fats || 20;

    const userRequestContext = context
      ? `\nUSER REQUEST: The user specifically asked for: "${context}". Incorporate this if possible.`
      : "";

    const systemPrompt = `You are an elite sports nutritionist. Generate a SINGLE replacement ${resolvedMealType} meal as a structured JSON template.

CURRENT MEAL BEING REPLACED:
- Name: ${currentData?.meal_name || "Unknown"}
- Calories: ${targetCalories} kcal
- Protein: ${targetProtein}g
- Carbs: ${targetCarbs}g
- Fats: ${targetFats}g

${dietaryInfo.length > 0 ? "DIETARY REQUIREMENTS:\n" + dietaryInfo.join("\n") : ""}
${userRequestContext}

NUTRITIONAL TARGETS (±10%):
- Calories: ${targetCalories} kcal
- Protein: ${targetProtein}g
- Carbs: ${targetCarbs}g
- Fats: ${targetFats}g

RULES:
1. Generate a DIFFERENT meal than "${currentData?.meal_name || ""}"
2. Keep similar nutritional values
3. Respect all dietary restrictions and allergies

RESPOND WITH ONLY THIS JSON (no markdown):
{
  "meal_name": "string",
  "servings": 1,
  "ingredients": [
    { "ingredient_name": "string", "grams": number, "calories": number, "protein_g": number, "carbs_g": number, "fats_g": number }
  ],
  "recipe_steps": ["Step 1", "Step 2"]
}`;

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
          JSON.stringify({ error: "Service temporarily busy. Please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Failed to generate replacement meal");

    // Parse AI response
    let newMealData;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();
      const jsonStart = cleanContent.indexOf("{");
      const jsonEnd = cleanContent.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
      newMealData = JSON.parse(cleanContent);
    } catch {
      throw new Error("Failed to parse replacement meal");
    }

    // Calculate totals from ingredients
    const ingredients = newMealData.ingredients || [];
    const totalCalories = Math.round(ingredients.reduce((s: number, i: any) => s + (i.calories || 0), 0));
    const totalProtein = Math.round(ingredients.reduce((s: number, i: any) => s + (i.protein_g || 0), 0) * 10) / 10;
    const totalCarbs = Math.round(ingredients.reduce((s: number, i: any) => s + (i.carbs_g || 0), 0) * 10) / 10;
    const totalFats = Math.round(ingredients.reduce((s: number, i: any) => s + (i.fats_g || 0), 0) * 10) / 10;

    // Update user_meals with new personalized_data (Template-First schema)
    const { error: updateError } = await supabase
      .from("user_meals")
      .update({
        personalized_data: newMealData,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fats: totalFats,
        base_template_id: null, // AI-generated swap, no base template
      })
      .eq("id", targetMeal.id);

    if (updateError) throw new Error("Failed to save replacement meal");

    console.log(`Swap Meal: Successfully swapped ${resolvedMealType} from "${currentData?.meal_name}" to "${newMealData.meal_name}"`);

    return new Response(
      JSON.stringify({
        success: true,
        swappedMeal: {
          meal_type: resolvedMealType,
          old_name: currentData?.meal_name,
          new_name: newMealData.meal_name,
          total_calories: totalCalories,
          total_protein: totalProtein,
          total_carbs: totalCarbs,
          total_fats: totalFats,
        },
        message: `I updated your ${resolvedMealType}. Let me know if you want to change another meal.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Swap Meal error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
