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
    const activityLevel = profile.activity_level || 'moderately_active';
    const otherSports = profile.other_sports || [];
    const fitnessGoal = profile.fitness_goal || 'general_health';
    const weightGoal = profile.weight_goal || weight;
    
    // Calculate protein target (1.6-2.2g/kg based on goal)
    let proteinPerKg = 1.8;
    if (fitnessGoal === 'muscle_gain' || fitnessGoal === 'gain_muscle') proteinPerKg = 2.2;
    if (fitnessGoal === 'fat_loss' || fitnessGoal === 'lose_weight') proteinPerKg = 2.0;
    
    // Increase protein if user does sports
    if (otherSports.length > 0) proteinPerKg += 0.2;
    
    const proteinTarget = Math.round(weight * proteinPerKg);
    
    // Fat: 25% of calories, Carbs: remainder
    const fatTarget = Math.round((calorieTarget * 0.25) / 9);
    const carbTarget = Math.round((calorieTarget - (proteinTarget * 4) - (fatTarget * 9)) / 4);

    // DYNAMIC MEAL COUNT based on user profile and goals
    let mealCount = 4; // default
    let mealTypes = ["breakfast", "lunch", "snack", "dinner"];
    
    // Determine meal count based on goal and calories
    if (fitnessGoal === 'muscle_gain' || fitnessGoal === 'gain_muscle') {
      // Bodybuilders/muscle gain: more frequent meals
      if (calorieTarget >= 2500) {
        mealCount = 5;
        mealTypes = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];
      } else if (calorieTarget >= 3000) {
        mealCount = 6;
        mealTypes = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"];
      }
    } else if (fitnessGoal === 'lose_weight' || fitnessGoal === 'fat_loss') {
      // Weight loss: depends on calorie target
      if (calorieTarget <= 1500) {
        mealCount = 3;
        mealTypes = ["breakfast", "lunch", "dinner"];
      }
    } else if (fitnessGoal === 'maintain') {
      // Maintenance: standard 4 meals
      mealCount = 4;
      mealTypes = ["breakfast", "lunch", "snack", "dinner"];
    }
    
    // Adjust for underweight users (lower appetite)
    const bmi = weight / ((height / 100) ** 2);
    if (bmi < 18.5) {
      // Underweight: smaller, more frequent meals if gaining, or fewer if maintaining
      if (weightGoal > weight) {
        mealCount = Math.min(5, mealCount + 1);
        if (!mealTypes.includes("morning_snack")) {
          mealTypes = ["breakfast", "morning_snack", "lunch", "snack", "dinner"];
        }
      }
    }
    
    // High activity: add extra snack if not already present
    if ((activityLevel === 'very_active' || activityLevel === 'extremely_active') && mealCount < 5) {
      mealCount = Math.min(5, mealCount + 1);
      if (!mealTypes.includes("afternoon_snack") && !mealTypes.includes("morning_snack")) {
        mealTypes.push("afternoon_snack");
      }
    }

    console.log(`Dynamic meal plan: ${mealCount} meals for goal: ${fitnessGoal}, BMI: ${bmi.toFixed(1)}`);

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

    const mealTypesString = mealTypes.map(t => `"${t}"`).join(", ");
    const mealJsonTemplate = mealTypes.map(t => 
      `{"meal_type":"${t}","name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"Step 1: ... Step 2: ... Step 3: ..."}`
    ).join(",");

    const systemPrompt = `You are an elite sports nutritionist. Generate a precisely calculated, personalized daily meal plan.

USER PROFILE:
- Age: ${age} years, Height: ${height} cm, Weight: ${weight} kg
- BMI: ${bmi.toFixed(1)}
- Goal Weight: ${weightGoal} kg
- Fitness Goal: ${fitnessGoal}
- Activity Level: ${activityLevel}
- Other Sports/Activities: ${otherSports.length > 0 ? otherSports.join(', ') : 'none'}
- Dietary Preference: ${profile.dietary_preference || 'omnivore'}
- Allergies: ${(profile.allergies || []).join(', ') || 'none'}
- Disliked Foods: ${(profile.disliked_foods || []).join(', ') || 'none'}
${otherSports.length > 0 ? `NOTE: User does ${otherSports.length} additional sports. Ensure adequate recovery nutrition and carbs for energy.` : ''}
${budgetTierInfo}

NUTRITIONAL TARGETS:
- Daily Calories: ${calorieTarget} kcal
- Protein: ${proteinTarget}g
- Fat: ${fatTarget}g
- Carbs: ${carbTarget}g

MEAL PLAN STRATEGY:
- Number of meals: ${mealCount}
- Meal types: ${mealTypesString}
- Distribute calories and macros evenly across meals
${fitnessGoal === 'muscle_gain' || fitnessGoal === 'gain_muscle' ? '- Focus on high-protein, calorie-dense meals for muscle building' : ''}
${fitnessGoal === 'lose_weight' || fitnessGoal === 'fat_loss' ? '- Focus on high-satiety, lower-calorie meals with adequate protein for fat loss' : ''}
${bmi < 18.5 ? '- User is underweight: include easily digestible, nutrient-dense options' : ''}

Generate exactly ${mealCount} meals with types: ${mealTypesString}.
For recipes, use NUMBERED STEPS format like: "Step 1: Chop vegetables. Step 2: Heat pan. Step 3: Cook for 5 minutes."

RESPOND WITH ONLY THIS JSON STRUCTURE (no markdown, no extra text):
{"meals":[${mealJsonTemplate}],"total_calories":${calorieTarget},"total_protein":${proteinTarget},"total_carbs":${carbTarget},"total_fats":${fatTarget}}`;

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
      
      // Normalize meal types to standard types for the app
      mealPlan.meals = mealPlan.meals.map((meal: any) => ({
        ...meal,
        meal_type: normalizeMealType(meal.meal_type),
      }));
      
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

// Normalize various meal type names to our standard types
function normalizeMealType(mealType: string): string {
  const type = mealType.toLowerCase().replace(/[_\s]+/g, '_');
  
  if (type.includes('breakfast')) return 'breakfast';
  if (type.includes('lunch')) return 'lunch';
  if (type.includes('dinner')) return 'dinner';
  if (type.includes('morning') && type.includes('snack')) return 'snack';
  if (type.includes('afternoon') && type.includes('snack')) return 'snack';
  if (type.includes('evening') && type.includes('snack')) return 'snack';
  if (type.includes('snack')) return 'snack';
  
  return 'snack'; // default to snack for unknown types
}
