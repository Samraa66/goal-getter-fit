import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security constants
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB for images

// Log AI call for monitoring
async function logAICall(serviceClient: any, userId: string, status: string, errorMessage?: string) {
  try {
    await serviceClient.from('ai_call_logs').insert({
      user_id: userId,
      function_name: 'analyze-menu',
      status,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error('Failed to log AI call:', e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Check payload size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(JSON.stringify({ error: 'Image too large. Maximum size is 10MB.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create client with user's auth context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Create service client for logging and rate limiting
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // SECURITY: Get authenticated user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RATE LIMITING: Check per-user AI generation limits
    const { data: rateLimitResult, error: rateLimitError } = await serviceClient.rpc('check_ai_rate_limit', {
      p_user_id: user.id
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log("Rate limit exceeded for user:", user.id, rateLimitResult);
      await logAICall(serviceClient, user.id, 'rate_limited', rateLimitResult.message);
      return new Response(JSON.stringify({ 
        error: rateLimitResult.message || "You've reached today's AI limit. Try again tomorrow.",
        rateLimited: true
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Menu Scanner: Authenticated user", user.id);

    const { image, mealType, profile } = await req.json();

    // SECURITY: Validate inputs
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: "No valid image provided" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate image is base64 or valid URL
    if (!image.startsWith('data:image/') && !image.startsWith('http')) {
      return new Response(JSON.stringify({ error: "Invalid image format" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const sanitizedMealType = validMealTypes.includes(mealType) ? mealType : 'lunch';

    console.log("Menu Scanner: Analyzing menu image for", sanitizedMealType);

    // Calculate user targets
    const calorieTarget = profile?.daily_calorie_target || 2000;
    const weightKg = profile?.weight_current || 70;
    const goal = profile?.fitness_goal || "maintain";
    
    // Protein: 1.6-2.2g per kg based on goal
    const proteinMultiplier = goal === "muscle_gain" ? 2.2 : goal === "fat_loss" ? 2.0 : 1.6;
    const proteinTarget = Math.round(weightKg * proteinMultiplier);
    
    // Meal allocation
    const mealAllocations: Record<string, { calories: number; protein: number }> = {
      breakfast: { calories: Math.round(calorieTarget * 0.25), protein: Math.round(proteinTarget * 0.25) },
      lunch: { calories: Math.round(calorieTarget * 0.30), protein: Math.round(proteinTarget * 0.30) },
      dinner: { calories: Math.round(calorieTarget * 0.30), protein: Math.round(proteinTarget * 0.30) },
      snack: { calories: Math.round(calorieTarget * 0.15), protein: Math.round(proteinTarget * 0.15) },
    };
    
    // Use sanitized meal type for allocations
    const mealAllocation = mealAllocations[sanitizedMealType] || mealAllocations.lunch;
    const dietaryPreference = profile?.dietary_preference || "none";
    const allergies = profile?.allergies?.join(", ") || "none";

    const goalDescriptions: Record<string, string> = {
      fat_loss: "lose weight while maintaining muscle mass",
      muscle_gain: "build muscle and gain strength",
      maintain: "maintain current weight and stay healthy",
      performance: "optimize athletic performance",
    };

    const systemPrompt = `You are an expert nutritionist helping someone who wants to ${goalDescriptions[goal] || "stay healthy"}.

USER PROFILE:
- Fitness Goal: ${goal}
- Daily Calorie Target: ${calorieTarget} kcal
- Daily Protein Target: ${proteinTarget}g
- Dietary Preference: ${dietaryPreference}
- Allergies/Restrictions: ${allergies}

MEAL CONTEXT:
- This is for their ${sanitizedMealType.toUpperCase()}
- Ideal calories for this meal: ~${mealAllocation.calories} kcal
- Ideal protein for this meal: ~${mealAllocation.protein}g

YOUR TASK:
1. Analyze the restaurant menu in the image
2. Identify options that best fit the user's ${sanitizedMealType} targets
3. Explain HOW each option helps them reach their ${goal} goal
4. Suggest modifications to make dishes fit their plan better

CRITICAL: Your recommendations must be PERSONALIZED. Don't give generic "healthy eating" advice. 
- Reference their specific calorie/protein targets
- Explain how each dish fits or exceeds their ${sanitizedMealType} allocation
- For ${goal} goal, prioritize ${goal === 'fat_loss' ? 'lower calorie, high protein options' : goal === 'muscle_gain' ? 'high protein, adequate calorie options' : 'balanced options'}

Respond with a JSON object in this exact format:
{
  "summary": "Brief summary of the menu type and what's available",
  "yourTargets": {
    "calorieTarget": ${calorieTarget},
    "proteinTarget": ${proteinTarget},
    "goal": "${goal}"
  },
  "healthyChoices": [
    {
      "name": "Dish name",
      "reason": "Why it's a good choice generally",
      "estimatedCalories": 450,
      "estimatedProtein": 35,
      "howItHelpsYou": "Specific explanation of how this helps their ${goal} goal. E.g., 'This gives you ${mealAllocation.protein}g protein in just ${mealAllocation.calories} calories, keeping you on track for ${goal}'",
      "modifications": ["Specific modifications like 'Ask for grilled instead of fried' or 'Get dressing on the side'"]
    }
  ],
  "recommendation": {
    "name": "Best overall choice for THIS USER",
    "reason": "Why this is the top pick based on their profile",
    "howItFitsYourPlan": "Detailed explanation of how this meal fits into their daily plan for ${goal}"
  }
}

Include 2-4 healthy choices. Be specific with calorie/protein estimates.`;

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this restaurant menu and find the best ${sanitizedMealType} options for me. Remember my goal is ${goal} and I need about ${mealAllocation.calories} calories and ${mealAllocation.protein}g protein for this meal. Return your response as valid JSON.`,
              },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        await logAICall(serviceClient, user.id, 'rate_limited', 'AI gateway rate limit');
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        await logAICall(serviceClient, user.id, 'error', 'Payment required');
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log("Menu Scanner: Raw response received");

    // Try to parse the JSON from the response
    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      analysis = {
        summary: content || "Could not analyze the menu properly.",
        yourTargets: {
          calorieTarget,
          proteinTarget,
          goal,
        },
        healthyChoices: [],
        recommendation: {
          name: "Unable to determine",
          reason: "Please try with a clearer image of the menu.",
          howItFitsYourPlan: "We couldn't analyze the menu clearly. Try taking another photo.",
        },
      };
    }

    console.log("Menu Scanner: Analysis complete");
    
    // Log successful call
    await logAICall(serviceClient, user.id, 'success');

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Menu Scanner error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
