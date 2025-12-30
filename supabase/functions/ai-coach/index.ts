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
    const { messages, profile, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("AI Coach: Processing request with", messages.length, "messages");

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

    const systemPrompt = `You are the Forme Coach — an adaptive AI fitness and nutrition coach that helps users find their balance, rhythm, and form in life.

You already understand the user. You have their profile, their goals, their history. You don't need to ask for data — you observe, infer, and adapt.

### Your Core Capabilities
1. **Conversational Coaching**: Answer questions, provide motivation, explain concepts
2. **Plan Modifications**: When users request changes to meals or workouts, acknowledge the request and confirm what will change
3. **Adaptive Intelligence**: Use the user's profile to personalize every response

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
- Be concise but helpful
- Never use disclaimers like "I don't have the capability to..."
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
