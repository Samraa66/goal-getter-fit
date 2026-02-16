import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    // Rate limit
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rl } = await adminClient.rpc("check_ai_rate_limit", { p_user_id: user.id });
    if (rl && !rl.allowed) {
      return new Response(JSON.stringify({ error: rl.message, rateLimited: true }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { templates, date } = await req.json();
    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      throw new Error("No templates provided");
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const calorieTarget = profile?.daily_calorie_target || 2000;
    const allergies = profile?.allergies || [];
    const dislikedFoods = profile?.disliked_foods || [];
    const dietaryPref = profile?.dietary_preference || "none";

    // Select one template per meal type
    const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
    const selectedTemplates: any[] = [];
    for (const type of mealTypes) {
      const matching = templates.filter((t: any) => t.meal_type === type);
      if (matching.length > 0) {
        selectedTemplates.push(matching[Math.floor(Math.random() * matching.length)]);
      }
    }

    if (selectedTemplates.length === 0) {
      throw new Error("No matching templates for meal types");
    }

    // Build AI prompt for personalization
    const templateDataForAI = selectedTemplates.map((t: any) => ({
      template_id: t.id,
      meal_type: t.meal_type,
      data: t.data,
    }));

    const systemPrompt = `You are a nutrition optimizer. You will receive structured meal template JSON objects.

YOUR TASK: Modify the ingredient quantities to match the user's calorie target while preserving the structure.

USER PROFILE:
- Daily calorie target: ${calorieTarget} kcal
- Dietary preference: ${dietaryPref}
${allergies.length > 0 ? `- ALLERGIES (REMOVE these ingredients): ${allergies.join(", ")}` : ""}
${dislikedFoods.length > 0 ? `- Disliked foods (substitute): ${dislikedFoods.join(", ")}` : ""}

RULES:
1. ONLY modify "grams", "calories", "protein_g", "carbs_g", "fats_g" values
2. DO NOT add new ingredients unless replacing an allergen/disliked food
3. DO NOT rename JSON keys
4. DO NOT remove the structure
5. Recalculate macros accurately when changing grams
6. Keep the same number of meals
7. Distribute calories across meals proportionally
8. Return ONLY valid JSON array, no markdown

INPUT:
${JSON.stringify(templateDataForAI, null, 2)}

OUTPUT FORMAT (array of objects):
[
  {
    "template_id": "...",
    "meal_type": "...",
    "personalized_data": { /* modified MealStructure */ },
    "total_calories": number,
    "total_protein": number,
    "total_carbs": number,
    "total_fats": number
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Personalize these meal templates. Return ONLY valid JSON array." },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI personalization failed");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Clean markdown
    if (content.startsWith("```json")) content = content.slice(7);
    if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    const personalized = JSON.parse(content);

    if (!Array.isArray(personalized)) throw new Error("AI returned non-array");

    // Save personalized meals to user_meals
    // First delete any existing for this date
    await supabase
      .from("user_meals")
      .delete()
      .eq("user_id", user.id)
      .eq("date_assigned", date);

    const inserts = personalized.map((p: any) => ({
      user_id: user.id,
      base_template_id: p.template_id,
      personalized_data: p.personalized_data,
      date_assigned: date,
      meal_type: p.meal_type,
      total_calories: p.total_calories,
      total_protein: p.total_protein,
      total_carbs: p.total_carbs,
      total_fats: p.total_fats,
    }));

    const { error: insertErr } = await adminClient
      .from("user_meals")
      .insert(inserts);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Failed to save personalized meals");
    }

    return new Response(JSON.stringify({ success: true, count: inserts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Personalize Meal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Something went wrong" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
