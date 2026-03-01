import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security constants
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_IN_CONTEXT = 20;
const MAX_PAYLOAD_SIZE = 100 * 1024; // 100KB max for chat

// Log AI call for monitoring
async function logAICall(serviceClient: any, userId: string, status: string, errorMessage?: string) {
  try {
    await serviceClient.from('ai_call_logs').insert({
      user_id: userId,
      function_name: 'ai-coach',
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
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
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

    // Create service client for logging (bypasses RLS)
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // RATE LIMITING: Check per-user AI generation limits
    const { data: rateLimitResult, error: rateLimitError } = await serviceClient.rpc('check_ai_rate_limit', {
      p_user_id: userId
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log("Rate limit exceeded for user:", userId, rateLimitResult);
      await logAICall(serviceClient, userId, 'rate_limited', rateLimitResult.message);
      return new Response(JSON.stringify({ 
        error: rateLimitResult.message || "You've reached today's AI limit. Try again tomorrow.",
        rateLimited: true,
        errorType: rateLimitResult.error
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let { messages, profile } = body;

    // SECURITY: Validate and sanitize messages
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit number of messages to prevent context injection attacks
    messages = messages.slice(-MAX_MESSAGES_IN_CONTEXT);

    // Sanitize each message content
    messages = messages.map((msg: any) => ({
      role: msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user',
      content: typeof msg.content === 'string' 
        ? msg.content.slice(0, MAX_MESSAGE_LENGTH) 
        : '',
    })).filter((msg: any) => msg.content.length > 0);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid messages provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("AI Coach: Processing request for authenticated user", userId, "with", messages.length, "messages");

    // Fetch subscription tier and user_insights for premium users
    const { data: subscription } = await serviceClient
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle();
    const isPremium = subscription?.tier === "paid";

    let userInsights: Record<string, unknown> | null = null;
    if (isPremium) {
      const { data: insights } = await serviceClient
        .from("user_insights")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      userInsights = insights as Record<string, unknown> | null;
    }

    // Build comprehensive user context from profile
    let userContext = "";
    if (profile) {
      const parts = [];
      
      // Core demographics
      if (profile.gender) {
        const genderLabel = profile.gender === 'non_binary' ? 'non-binary/not specified' : profile.gender;
        parts.push(`Gender: ${genderLabel}`);
      }
      if (profile.age) parts.push(`Age: ${profile.age} years`);
      if (profile.height_cm) parts.push(`Height: ${profile.height_cm} cm`);
      if (profile.weight_current) parts.push(`Current weight: ${profile.weight_current} kg`);
      if (profile.weight_goal) parts.push(`Goal weight: ${profile.weight_goal} kg`);
      
      // Fitness profile
      if (profile.fitness_goal) parts.push(`Goal: ${profile.fitness_goal.replace(/_/g, ' ')}`);
      if (profile.experience_level) parts.push(`Experience: ${profile.experience_level}`);
      if (profile.workout_location) parts.push(`Workouts at: ${profile.workout_location}`);
      if (profile.activity_level) parts.push(`Activity level: ${profile.activity_level.replace(/_/g, ' ')}`);
      if (profile.workouts_per_week) parts.push(`Workouts per week: ${profile.workouts_per_week}`);
      if (profile.preferred_split) parts.push(`Preferred split: ${profile.preferred_split.replace(/_/g, ' ')}`);
      
      // Sports and activities
      if (profile.other_sports?.length) {
        parts.push(`Other sports/activities: ${profile.other_sports.join(", ")}`);
        parts.push(`NOTE: User does ${profile.other_sports.length} additional sport(s). Adjust workout frequency and recovery accordingly.`);
      }
      
      // Nutrition
      if (profile.dietary_preference && profile.dietary_preference !== 'none') {
        parts.push(`Diet: ${profile.dietary_preference}`);
      }
      if (profile.daily_calorie_target) parts.push(`Daily calories: ${profile.daily_calorie_target} kcal`);
      if (profile.daily_food_budget) parts.push(`Daily food budget: $${profile.daily_food_budget}`);
      if (profile.allergies?.length) parts.push(`Allergies: ${profile.allergies.join(", ")}`);
      if (profile.disliked_foods?.length) parts.push(`Dislikes: ${profile.disliked_foods.join(", ")}`);
      
      if (parts.length > 0) {
        userContext = `\n\n====== USER PROFILE ======\n${parts.join("\n")}`;
      }
    }

    // For premium users: inject full user_insights so the coach feels like it truly knows the user
    if (isPremium && userInsights && Object.keys(userInsights).length > 0) {
      const insightParts: string[] = [];
      if (userInsights.avoided_foods?.length) {
        insightParts.push(`Avoided foods: ${(userInsights.avoided_foods as string[]).join(", ")}`);
      }
      if (userInsights.favorite_cuisines?.length) {
        insightParts.push(`Favorite cuisines: ${(userInsights.favorite_cuisines as string[]).join(", ")}`);
      }
      if (userInsights.workout_consistency_score != null) {
        insightParts.push(`Workout consistency: ${Math.round((userInsights.workout_consistency_score as number) * 100)}%`);
      }
      if (userInsights.hydration_consistency != null) {
        insightParts.push(`Hydration consistency: ${Math.round((userInsights.hydration_consistency as number) * 100)}%`);
      }
      if (userInsights.energy_pattern) {
        insightParts.push(`Energy pattern: ${userInsights.energy_pattern} person`);
      }
      if (userInsights.most_skipped_meal_type) {
        insightParts.push(`Often skips: ${userInsights.most_skipped_meal_type}`);
      }
      if (userInsights.most_completed_workout_type) {
        insightParts.push(`Completes most: ${userInsights.most_completed_workout_type} workouts`);
      }
      if (userInsights.avg_calories_consumed && (userInsights.avg_calories_consumed as number) > 0) {
        insightParts.push(`Avg calories consumed (from scans): ~${Math.round(userInsights.avg_calories_consumed as number)} kcal`);
      }
      if (userInsights.preferred_meal_times && Object.keys(userInsights.preferred_meal_times as object).length > 0) {
        insightParts.push(`Preferred meal times: ${JSON.stringify(userInsights.preferred_meal_times)}`);
      }
      if (insightParts.length > 0) {
        userContext += `\n\n====== LEARNED USER INSIGHTS (you know this user well) ======\n${insightParts.join("\n")}`;
      }
    }

    const systemPrompt = `You are the Forme Coach — an adaptive AI fitness and nutrition coach that helps users find their balance, rhythm, and form in life.

You already understand the user. You have their profile, their goals, their history. You don't need to ask for data — you observe, infer, and adapt.

CRITICAL RULES:
1. ALWAYS respond to ANY user question - never ignore messages
2. NEVER ask onboarding questions - the user has already completed onboarding
3. Use the profile data provided below to personalize responses
4. If you're unsure what the user means, make your best guess and answer helpfully
5. Keep responses conversational and friendly

### Your Core Capabilities
1. **Answer ANY Question**: Whether about fitness, nutrition, their plan, or general wellness - always provide a helpful response
2. **Conversational Coaching**: Provide motivation, explain concepts, give advice
3. **Plan Modifications**: When users request changes, acknowledge and confirm
4. **General Guidance**: Handle questions like "Why is this meal high in calories?", "Should I rest?", "Can I train abs more?", "What if I miss a day?"

### Example Questions You MUST Answer:
- "Can I swap today's workout?" → Suggest alternatives based on their split
- "Why is this meal so high in calories?" → Explain macro distribution and goals
- "I feel tired, should I rest?" → Give recovery advice based on their schedule
- "Can I train abs more?" → Explain core training frequency
- "What if I miss a day?" → Reassure and suggest catch-up options
- "Is this too much protein?" → Explain protein targets for their goal
- "How do I progress?" → Give progressive overload tips
- Any general fitness/nutrition question → Answer helpfully!

### Detecting Modification Requests
When a user says things like:
- "I don't want this meal" / "Can I eat something else for dinner?"
- "This workout is too hard" / "Can we make it easier?"
- "I want a different split" / "Switch to push/pull/legs"
- "Skip leg day this week"

You should:
1. Acknowledge their request warmly
2. Confirm what change you're making
3. Explain briefly why (if relevant to their goals)
4. Let them know the app will update their plan

Example responses:
- "Got it! I'll swap your dinner for something lighter. Give me a moment to regenerate your meal plan. 🍽️"
- "No problem — I'll adjust your workout intensity this week. Your updated program will reflect easier progressions."
- "Switching you to a Push/Pull/Legs split! This works great with your ${profile?.workouts_per_week || 3} days per week."

### Gender-Aware Coaching
${profile?.gender === 'male' ? `- User is male: Can reference typical male physiology for strength/muscle building expectations` : ''}
${profile?.gender === 'female' ? `- User is female: Consider menstrual cycle impact on training if mentioned, emphasize that women can and should lift heavy, focus on functional strength and body composition over weight` : ''}
${profile?.gender === 'non_binary' || !profile?.gender ? `- Gender not specified: Use neutral language, avoid assumptions about physiology, focus on individual goals and preferences` : ''}

### Training Structure (Mandatory Rules)
- All workouts must follow ONE of: Push, Pull, Legs, Upper, Lower, or Full Body
- Push = chest, shoulders, triceps only
- Pull = back, rear delts, biceps only  
- Legs = quads, hamstrings, glutes, calves only
- Never combine muscle groups randomly
- If someone seems fatigued, suggest rest — don't force a workout

### Nutrition & Budget
- Respect the user's food budget with practical, affordable options
- NEVER suggest foods the user is allergic to
- Respect dietary preferences (vegetarian/vegan/keto/etc.)
- Increase protein on training days

### Communication Style
- Warm, calm, confident, and human
- Refer to their plan as "your Forme" — their state, balance, rhythm
- Be concise but helpful - aim for 2-4 sentences for simple questions
- NEVER use disclaimers like "I don't have the capability to..."
- NEVER say "I can't" or "I'm not able to" - always provide helpful guidance
- Use emojis sparingly to add warmth

### Safety
Always prioritize user safety. For medical concerns, recommend consulting healthcare professionals. Never provide specific medical advice.${userContext}`;

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
          ...messages,
        ],
        stream: true,
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

    console.log("AI Coach: Streaming response");
    
    // Log successful call
    await logAICall(serviceClient, userId, 'success');

    // Fire-and-forget: extract profile updates and coach signals (non-blocking)
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop()?.content;
    if (lastUserMessage) {
      fetch(`${SUPABASE_URL}/functions/v1/extract-profile-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ message: lastUserMessage }),
      }).catch((e) => console.error("Fire-and-forget extract-profile-updates failed:", e));
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI Coach error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
