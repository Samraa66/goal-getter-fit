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
    // SECURITY: Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Create client with user's auth context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // SECURITY: Get authenticated user from JWT - never trust client-supplied userId
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id; // SECURITY: Always use authenticated user's ID

    const body = await req.json();
    let profile = body.profile;
    const date = body.date;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch profile from database using authenticated user's ID
    if (!profile) {
      console.log("Generate Meal Plan: Fetching profile for authenticated user", userId);
      const { data: fetchedProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (error) {
        console.error("Failed to fetch profile:", error);
        throw new Error("Could not fetch user profile");
      }
      profile = fetchedProfile;
    }

    if (!profile) {
      throw new Error("Profile data is required");
    }

    console.log("Generate Meal Plan: Creating plan for", date);

    // Extract profile data with defaults
    const weight = profile.weight_current || 70;
    const height = profile.height_cm || 170;
    const age = profile.age || 30;
    const gender = profile.gender || 'not_specified';
    const calorieTarget = profile.daily_calorie_target || 2000;
    const dailyBudget = profile.daily_food_budget || null;
    const activityLevel = profile.activity_level || 'moderately_active';
    const otherSports = profile.other_sports || [];
    const fitnessGoal = profile.fitness_goal || 'general_health';
    const weightGoal = profile.weight_goal || weight;
    const dietaryPreference = profile.dietary_preference || 'none';
    const allergies = profile.allergies || [];
    const dislikedFoods = profile.disliked_foods || [];
    
    // Gender-based BMR adjustment using Mifflin-St Jeor
    let bmr;
    if (gender === 'male') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else if (gender === 'female') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    } else {
      // Non-binary/not specified: use average
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 78;
    }

    // Calculate protein target (1.6-2.2g/kg based on goal and gender)
    let proteinPerKg = 1.8;
    if (fitnessGoal === 'muscle_gain' || fitnessGoal === 'gain_muscle') proteinPerKg = 2.2;
    if (fitnessGoal === 'fat_loss' || fitnessGoal === 'lose_weight') proteinPerKg = 2.0;
    if (otherSports.length > 0) proteinPerKg += 0.2;
    
    const proteinTarget = Math.round(weight * proteinPerKg);
    
    // Fat: 25% of calories, Carbs: remainder
    const fatTarget = Math.round((calorieTarget * 0.25) / 9);
    const carbTarget = Math.round((calorieTarget - (proteinTarget * 4) - (fatTarget * 9)) / 4);

    // DYNAMIC MEAL COUNT based on user profile and goals
    let mealCount = 4;
    let mealTypes = ["breakfast", "lunch", "snack", "dinner"];
    
    if (fitnessGoal === 'muscle_gain' || fitnessGoal === 'gain_muscle') {
      if (calorieTarget >= 2500) {
        mealCount = 5;
        mealTypes = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];
      }
    } else if (fitnessGoal === 'lose_weight' || fitnessGoal === 'fat_loss') {
      if (calorieTarget <= 1500) {
        mealCount = 3;
        mealTypes = ["breakfast", "lunch", "dinner"];
      }
    }
    
    // Adjust for BMI
    const bmi = weight / ((height / 100) ** 2);
    if (bmi < 18.5 && weightGoal > weight) {
      mealCount = Math.min(5, mealCount + 1);
      if (!mealTypes.includes("morning_snack")) {
        mealTypes = ["breakfast", "morning_snack", "lunch", "snack", "dinner"];
      }
    }
    
    // High activity: add extra snack
    if ((activityLevel === 'very_active' || activityLevel === 'extremely_active') && mealCount < 5) {
      mealCount = Math.min(5, mealCount + 1);
      if (!mealTypes.includes("afternoon_snack") && !mealTypes.includes("morning_snack")) {
        mealTypes.push("afternoon_snack");
      }
    }

    console.log(`Dynamic meal plan: ${mealCount} meals for goal: ${fitnessGoal}, gender: ${gender}, BMI: ${bmi.toFixed(1)}`);

    // Build dietary restriction string
    const dietaryInfo = [];
    if (dietaryPreference && dietaryPreference !== 'none') {
      dietaryInfo.push(`Diet: ${dietaryPreference.toUpperCase()}`);
    }
    if (allergies.length > 0) {
      dietaryInfo.push(`CRITICAL ALLERGIES (NEVER include): ${allergies.join(', ')}`);
    }
    if (dislikedFoods.length > 0) {
      dietaryInfo.push(`Foods to avoid: ${dislikedFoods.join(', ')}`);
    }

    const budgetTierInfo = dailyBudget ? `
BUDGET CONSTRAINT: $${dailyBudget}/day
Budget-Tier Food Selection Rules:
- LOW BUDGET ($5-10/day): Prioritize eggs, oats, rice, potatoes, lentils, beans, canned tuna, frozen vegetables, bananas, peanut butter, whole milk, cottage cheese
- MEDIUM BUDGET ($10-20/day): Add chicken breast, turkey, Greek yogurt, fresh vegetables, ground beef, cheese, bread
- HIGH BUDGET ($20+/day): Can include salmon, steak, berries, avocados, nuts, specialty items

CRITICAL BUDGET RULES:
1. Total daily meal cost MUST NOT exceed $${dailyBudget}
2. If budget is tight, automatically substitute expensive items with affordable alternatives` : '';

    const mealTypesString = mealTypes.map(t => `"${t}"`).join(", ");
    const mealJsonTemplate = mealTypes.map(t => 
      `{"meal_type":"${t}","name":"string","description":"string","calories":number,"protein":number,"carbs":number,"fats":number,"recipe":"1. First action. 2. Second action. 3. Third action."}`
    ).join(",");

    // Gender-specific nutrition notes
    const genderNutritionNotes = gender === 'female' 
      ? `- Consider iron-rich foods (leafy greens, lean red meat, legumes)
- Include calcium sources for bone health
- Omega-3 fatty acids for hormonal balance`
      : gender === 'male'
      ? `- Focus on zinc-rich foods (meat, shellfish, seeds)
- Include healthy fats for testosterone support
- Adequate vitamin D sources`
      : `- Balanced micronutrient profile
- Focus on whole foods and variety`;

    const systemPrompt = `You are an elite sports nutritionist. Generate a precisely calculated, personalized daily meal plan.

USER PROFILE:
- Age: ${age} years, Height: ${height} cm, Weight: ${weight} kg
- Gender: ${gender === 'non_binary' ? 'not specified (use neutral/average calculations)' : gender}
- BMI: ${bmi.toFixed(1)}, BMR: ${Math.round(bmr)} kcal
- Goal Weight: ${weightGoal} kg
- Fitness Goal: ${fitnessGoal.replace(/_/g, ' ')}
- Activity Level: ${activityLevel.replace(/_/g, ' ')}
- Other Sports/Activities: ${otherSports.length > 0 ? otherSports.join(', ') : 'none'}
${dietaryInfo.length > 0 ? '\nDIETARY REQUIREMENTS:\n' + dietaryInfo.join('\n') : ''}
${budgetTierInfo}

NUTRITIONAL TARGETS:
- Daily Calories: ${calorieTarget} kcal
- Protein: ${proteinTarget}g (${proteinPerKg}g/kg body weight)
- Fat: ${fatTarget}g
- Carbs: ${carbTarget}g

GENDER-SPECIFIC NUTRITION NOTES:
${genderNutritionNotes}

MEAL PLAN STRATEGY:
- Number of meals: ${mealCount}
- Meal types: ${mealTypesString}
- Distribute calories and macros evenly across meals
${fitnessGoal === 'muscle_gain' || fitnessGoal === 'gain_muscle' ? '- Focus on high-protein, calorie-dense meals for muscle building' : ''}
${fitnessGoal === 'lose_weight' || fitnessGoal === 'fat_loss' ? '- Focus on high-satiety, lower-calorie meals with adequate protein' : ''}

Generate exactly ${mealCount} meals with types: ${mealTypesString}.

RECIPE FORMAT RULES (CRITICAL):
- NO separate ingredients section
- Each step = ONE cooking action only
- Each step = ONE sentence only
- Format: "1. Bring water to a boil. 2. Add oats and reduce heat. 3. Simmer for 5 minutes."

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
        return new Response(JSON.stringify({ error: "We're experiencing high demand. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI Raw Response length:", content?.length);

    if (!content) {
      console.error("No content in AI response");
      throw new Error("Failed to generate meal plan. Please try again.");
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
      throw new Error("Failed to generate valid meal plan. Please try again.");
    }

    console.log("Generate Meal Plan: Success, returning", mealPlan.meals?.length, "meals");

    return new Response(JSON.stringify(mealPlan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate Meal Plan error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
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
