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

    // Calculate BMR and macros based on profile
    const weight = profile.weight_current || 70;
    const height = profile.height_cm || 170;
    const age = profile.age || 30;
    const calorieTarget = profile.daily_calorie_target || 2000;
    const dailyBudget = profile.daily_food_budget || null;
    
    // Calculate protein target (1.6-2.2g/kg based on goal)
    let proteinPerKg = 1.8;
    if (profile.fitness_goal === 'muscle_gain') proteinPerKg = 2.2;
    if (profile.fitness_goal === 'fat_loss') proteinPerKg = 2.0;
    const proteinTarget = Math.round(weight * proteinPerKg);
    
    // Fat: 25% of calories, Carbs: remainder
    const fatTarget = Math.round((calorieTarget * 0.25) / 9);
    const carbTarget = Math.round((calorieTarget - (proteinTarget * 4) - (fatTarget * 9)) / 4);

    const budgetTierInfo = dailyBudget ? `
BUDGET CONSTRAINT: $${dailyBudget}/day
Budget-Tier Food Selection Rules:
- LOW BUDGET ($5-10/day): Prioritize eggs, oats, rice, potatoes, lentils, beans, canned tuna, frozen vegetables, bananas, peanut butter, whole milk, cottage cheese
- MEDIUM BUDGET ($10-20/day): Add chicken breast, turkey, Greek yogurt, fresh vegetables, ground beef, cheese, bread
- HIGH BUDGET ($20+/day): Can include salmon, steak, berries, avocados, nuts, specialty items

CRITICAL BUDGET RULES:
1. Total daily meal cost MUST NOT exceed $${dailyBudget}
2. Estimate realistic grocery store prices for each ingredient
3. If budget is tight, automatically substitute expensive items with affordable alternatives
4. Include estimated cost per meal in output
5. If target macros cannot be perfectly achieved within budget, get as close as possible and note any compromises` : '';

    const systemPrompt = `You are an elite sports nutritionist. Generate a precisely calculated, personalized daily meal plan.

USER PROFILE:
- Age: ${age} years, Height: ${height} cm, Weight: ${weight} kg
- Goal Weight: ${profile.weight_goal || weight} kg
- Fitness Goal: ${profile.fitness_goal || 'general_health'}
- Dietary Preference: ${profile.dietary_preference || 'omnivore'}
- Allergies: ${(profile.allergies || []).join(', ') || 'none'}
- Disliked Foods: ${(profile.disliked_foods || []).join(', ') || 'none'}
${budgetTierInfo}

NUTRITIONAL TARGETS:
- Daily Calories: ${calorieTarget} kcal
- Protein: ${proteinTarget}g
- Fat: ${fatTarget}g
- Carbs: ${carbTarget}g

Generate exactly 4 meals (breakfast, lunch, snack, dinner).

RESPOND WITH ONLY THIS JSON STRUCTURE (no markdown, no extra text):
{"meals":[{"meal_type":"breakfast","name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"string"},{"meal_type":"lunch","name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"string"},{"meal_type":"snack","name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"string"},{"meal_type":"dinner","name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"string"}],"total_calories":${calorieTarget},"total_protein":${proteinTarget},"total_carbs":${carbTarget},"total_fats":${fatTarget}}`;

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
          { role: "user", content: `Generate meal plan for ${date}. Return ONLY valid JSON, no markdown.` },
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
    
    console.log("AI Raw Response length:", content?.length);
    console.log("AI Response preview:", content?.substring(0, 500));

    if (!content) {
      console.error("No content in AI response");
      throw new Error("No response from AI");
    }

    // Parse the JSON response with robust cleaning
    let mealPlan;
    try {
      let cleanContent = content.trim();
      
      // Remove markdown code blocks
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      // Try to find JSON object in the response
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
      }
      
      mealPlan = JSON.parse(cleanContent);
      
      // Validate the structure
      if (!mealPlan.meals || !Array.isArray(mealPlan.meals)) {
        throw new Error("Invalid meal plan structure - missing meals array");
      }
      
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Content that failed to parse:", content?.substring(0, 1000));
      throw new Error("Failed to generate valid meal plan - AI returned invalid format");
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
