import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, date } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generate Meal Plan: Creating plan for", date);

    const hasBudget = profile.daily_food_budget && profile.daily_food_budget > 0;
    const budgetInstruction = hasBudget 
      ? `- Daily Food Budget: $${profile.daily_food_budget} (IMPORTANT: Suggest affordable, budget-friendly ingredients that fit within this limit. Prioritize cost-effective proteins like eggs, beans, lentils, chicken thighs, canned fish. Avoid expensive items like steak, salmon, exotic ingredients.)`
      : '';

    const systemPrompt = `You are an expert nutritionist AI. Generate a personalized daily meal plan based on the user's profile.

User Profile:
- Fitness Goal: ${profile.fitness_goal || 'general health'}
- Daily Calorie Target: ${profile.daily_calorie_target || 2000} kcal
- Dietary Preference: ${profile.dietary_preference || 'none specified'}
- Allergies: ${(profile.allergies || []).join(', ') || 'none'}
- Disliked Foods: ${(profile.disliked_foods || []).join(', ') || 'none'}
${budgetInstruction}

Generate exactly 4 meals: breakfast, lunch, snack, and dinner.

IMPORTANT: You must respond with ONLY valid JSON, no markdown, no explanation. Use this exact format:
{
  "meals": [
    {
      "meal_type": "breakfast",
      "name": "Meal name",
      "description": "Brief description",
      "calories": 350,
      "protein": 25,
      "carbs": 40,
      "fats": 12,
      "recipe": "Brief cooking instructions"
    }
  ],
  "total_calories": 1800,
  "total_protein": 120,
  "total_carbs": 200,
  "total_fats": 60
}

Make sure:
1. Total calories are close to the target (${profile.daily_calorie_target || 2000})
2. Meals are balanced and nutritious
3. Respect dietary preferences and allergies
4. Include variety and practical, easy-to-make meals${hasBudget ? '\n5. PRIORITIZE AFFORDABILITY - use budget-friendly ingredients that fit within the daily food budget' : ''}`;

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
          { role: "user", content: `Generate a meal plan for ${date}. Remember to output ONLY valid JSON.` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI Response:", content);

    // Parse the JSON response
    let mealPlan;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      mealPlan = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to generate valid meal plan");
    }

    console.log("Generate Meal Plan: Success, returning", mealPlan.meals?.length, "meals");

    return new Response(JSON.stringify(mealPlan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate Meal Plan error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
