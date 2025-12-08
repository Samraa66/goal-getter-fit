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
    const { messages, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("AI Coach: Processing request with", messages.length, "messages");

    // Build user context from profile
    let userContext = "";
    if (profile) {
      const parts = [];
      if (profile.fitness_goal) parts.push(`Goal: ${profile.fitness_goal}`);
      if (profile.experience_level) parts.push(`Experience: ${profile.experience_level}`);
      if (profile.workout_location) parts.push(`Workouts at: ${profile.workout_location}`);
      if (profile.dietary_preference) parts.push(`Diet: ${profile.dietary_preference}`);
      if (profile.daily_calorie_target) parts.push(`Daily calories: ${profile.daily_calorie_target}`);
      if (profile.weight_current) parts.push(`Current weight: ${profile.weight_current}kg`);
      if (profile.weight_goal) parts.push(`Goal weight: ${profile.weight_goal}kg`);
      if (profile.height_cm) parts.push(`Height: ${profile.height_cm}cm`);
      if (profile.age) parts.push(`Age: ${profile.age}`);
      if (profile.allergies?.length) parts.push(`Allergies: ${profile.allergies.join(", ")}`);
      if (profile.disliked_foods?.length) parts.push(`Dislikes: ${profile.disliked_foods.join(", ")}`);
      
      if (parts.length > 0) {
        userContext = `\n\nUser Profile:\n${parts.join("\n")}`;
      }
    }

    const systemPrompt = `You are an expert AI fitness and nutrition coach. You help users achieve their health and fitness goals with personalized advice.

Your expertise includes:
- Nutrition planning and meal suggestions
- Workout routines and exercise recommendations
- Weight management strategies
- Motivational support and habit building
- Understanding macros, calories, and nutritional values

Guidelines:
- Be encouraging and supportive
- Give specific, actionable advice
- DO NOT ask for information that's already in the user profile below
- Use the user's profile data to personalize all recommendations
- Keep responses concise but helpful
- Use emojis sparingly to add warmth

Always prioritize user safety - recommend consulting healthcare professionals for medical concerns.${userContext}`;

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
