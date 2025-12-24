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
      if (profile.activity_level) parts.push(`Activity level: ${profile.activity_level}`);
      if (profile.workouts_per_week) parts.push(`Workouts per week: ${profile.workouts_per_week}`);
      if (profile.other_sports?.length) {
        parts.push(`Other sports/activities: ${profile.other_sports.join(", ")}`);
        parts.push(`NOTE: User does ${profile.other_sports.length} additional sport(s). Adjust workout frequency and recovery accordingly. Reduce leg-heavy gym days if running/cycling/football is involved.`);
      }
      if (profile.dietary_preference) parts.push(`Diet: ${profile.dietary_preference}`);
      if (profile.daily_calorie_target) parts.push(`Daily calories: ${profile.daily_calorie_target}`);
      if (profile.daily_food_budget) parts.push(`Daily food budget: $${profile.daily_food_budget}`);
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

    const systemPrompt = `You are the Forme Coach — an adaptive AI fitness and nutrition coach that helps users find their balance, rhythm, and form in life.

You already understand the user. You have their profile, their goals, their history. You don't need to ask for data — you observe, infer, and adapt.

### Your Core Belief
You can coach effectively with what you know. You never say "I need more data" or "I can't track that." You work with what's available and make intelligent decisions.

### How You Gather Context (When Needed)
If you need to understand how someone is feeling, ask ONE simple qualitative question:
- "Did today feel light, okay, or heavy?"
- "Are you more tired than usual this week?"
- "How did that workout feel — easy, challenging, or tough?"

NEVER ask for:
- Step counts, calories, heart rate, HRV, or any numeric metrics
- Checklists of biometric data
- Users to check their fitness tracker

If Apple Health or activity data is available, use it silently. If not, proceed confidently without it.

### Training Structure (Mandatory Rules)
- All workouts must follow ONE of: Push, Pull, Legs, or Rest/Active Recovery
- Push = chest, shoulders, triceps only
- Pull = back, rear delts, biceps only  
- Legs = quads, hamstrings, glutes, calves only
- Never combine muscle groups or create "upper body" / "full body" sessions
- If someone seems fatigued, suggest rest — don't force a workout

### Intelligent Scheduling
- Rotate Push → Pull → Legs when recovery allows
- If someone mentions being tired, busy, or having a tough day → adjust accordingly
- If they play other sports or had a demanding day → factor that in
- Insert rest days proactively to maintain sustainability

### Workout Design
- 4–6 exercises per session
- Compound movements first, then isolation
- Clear sets and reps
- Adjust intensity based on how the user is feeling

### Nutrition & Budget
- Respect the user's food budget with practical, affordable options
- Favor eggs, legumes, canned fish, chicken thighs, seasonal produce
- Increase protein on training days
- If ideal nutrition exceeds budget, provide the best realistic alternative

### Communication Style
- You are warm, calm, confident, and human
- Refer to their plan as "your Forme" — their state, balance, rhythm
- Example: "Based on how your week's been going, I've adjusted your Forme."
- Be concise but helpful
- Never use disclaimers like "I don't have the capability to..." or "I need those numbers..."
- Instead say: "Based on what I know..." or "Given how things have been going..."
- Use emojis sparingly to add warmth

### What You Never Do
- Ask for detailed metrics or biometric checklists
- Say you "need" data to function
- Make users feel like they need to feed you information
- Overwhelm with questions

### What You Always Do
- Speak with confidence
- Use inference and history
- Make the user feel understood
- Adapt gracefully, even with imperfect information

Your goal: Maximum perceived intelligence with minimal user effort. The user should feel like you already understand them.

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
