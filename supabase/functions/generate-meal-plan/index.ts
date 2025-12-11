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

    const systemPrompt = `You are an elite sports nutritionist and registered dietitian. Generate a precisely calculated, personalized daily meal plan.

====== USER PROFILE ======
- Age: ${age} years
- Height: ${height} cm
- Current Weight: ${weight} kg
- Goal Weight: ${profile.weight_goal || weight} kg
- Fitness Goal: ${profile.fitness_goal || 'general_health'}
- Dietary Preference: ${profile.dietary_preference || 'omnivore'}
- Allergies: ${(profile.allergies || []).join(', ') || 'none'}
- Disliked Foods: ${(profile.disliked_foods || []).join(', ') || 'none'}
${budgetTierInfo}

====== NUTRITIONAL TARGETS (MUST FOLLOW PRECISELY) ======
- Daily Calories: ${calorieTarget} kcal (±5% tolerance: ${Math.round(calorieTarget * 0.95)}-${Math.round(calorieTarget * 1.05)})
- Protein: ${proteinTarget}g (${proteinPerKg}g/kg for ${profile.fitness_goal || 'maintenance'})
- Fat: ${fatTarget}g (25% of calories)
- Carbs: ${carbTarget}g (remaining calories)

====== MEAL STRUCTURE ======
Generate exactly 4 meals with this calorie distribution:
- Breakfast: ~25% of daily calories (~${Math.round(calorieTarget * 0.25)} kcal)
- Lunch: ~30% of daily calories (~${Math.round(calorieTarget * 0.30)} kcal)
- Snack: ~15% of daily calories (~${Math.round(calorieTarget * 0.15)} kcal)
- Dinner: ~30% of daily calories (~${Math.round(calorieTarget * 0.30)} kcal)

====== REQUIREMENTS ======
1. Each meal must include exact gram measurements for all ingredients
2. Provide step-by-step cooking instructions (simple, realistic, under 20 minutes prep)
3. Prioritize whole foods, lean proteins, complex carbs, healthy fats
4. Ensure protein is distributed across all meals (25-40g per main meal)
5. Include a variety of vegetables and micronutrient-dense foods
6. Make meals practical and easy to prepare
7. NEVER include any foods the user is allergic to or dislikes
8. Respect dietary preferences strictly (vegetarian, vegan, etc.)

====== OUTPUT FORMAT (STRICT JSON, NO MARKDOWN) ======
{
  "meals": [
    {
      "meal_type": "breakfast",
      "name": "Meal Name",
      "description": "Brief appetizing description",
      "ingredients": [
        {"name": "Ingredient", "grams": 100, "estimated_cost": 0.50}
      ],
      "calories": 500,
      "protein": 35,
      "carbs": 45,
      "fats": 18,
      "recipe": "Step 1: ... Step 2: ... Step 3: ...",
      "prep_time_minutes": 15,
      "estimated_cost": 2.50
    }
  ],
  "total_calories": ${calorieTarget},
  "total_protein": ${proteinTarget},
  "total_carbs": ${carbTarget},
  "total_fats": ${fatTarget},
  "total_cost": 0.00,
  "grocery_list": [
    {"name": "Ingredient", "grams": 100, "estimated_cost": 0.50}
  ],
  "budget_notes": "Any notes about budget constraints or substitutions made"
}

CRITICAL: Output ONLY valid JSON. No markdown, no explanations, no code blocks.`;

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
          { role: "user", content: `Generate a complete meal plan for ${date}. Output ONLY valid JSON.` },
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
