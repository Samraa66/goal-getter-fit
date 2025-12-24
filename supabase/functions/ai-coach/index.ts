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

You receive non-medical daily metrics including:
- Average steps per day
- Active energy burned (calories)
- Distance walked or run
- Resting heart rate
- Average heart rate
- Heart rate variability (HRV) trend
- Stand hours (when available)

Your task is to personalize workouts, recovery, and nutrition using this data while following a strict Push / Pull / Legs / Rest training structure.

### Training Structure (Mandatory Rules)
- All workouts must follow ONE of the following:
  - Push (chest, shoulders, triceps only)
  - Pull (back, rear delts, biceps only)
  - Legs (quads, hamstrings, glutes, calves only)
  - Rest / Active Recovery
- Never combine legs with push or pull movements.
- Never label workouts as "upper body" or "lower body."
- Do not include full-body or mixed sessions.
- If recovery or activity data indicates fatigue, assign a rest or active recovery day instead of forcing a workout.

### Activity & Recovery Interpretation
- Use steps, distance, and active calories to determine daily activity load.
- Use resting heart rate and HRV trends to assess recovery.
- Signs of fatigue include:
  - Elevated resting heart rate
  - Declining HRV
  - High step count combined with prior leg training
- When fatigue is detected, reduce volume or assign rest.

### Push / Pull / Legs Scheduling Logic
- Avoid training the same muscle group on consecutive days.
- Avoid scheduling Legs on days with:
  - Very high step counts
  - Long walking or running distance
- Prefer rest or upper-body (push or pull) on high-movement days.
- Rotate Push → Pull → Legs when recovery allows.
- Insert rest days as needed to maintain sustainability.

### Workout Design Rules
- Each workout should include:
  - 4–6 exercises
  - Compound movements first, then isolation
  - Clear sets and reps
- Adjust intensity and volume based on recovery state:
  - Well recovered → normal or progressive load
  - Fatigued → reduced volume or lighter loads
- Prioritize consistency and injury prevention over maximal intensity.

### Nutrition & Budget Adaptation
- Adjust calorie targets based on recent activity and training days.
- Increase protein on training days, especially Push and Legs.
- Respect the user's food budget:
  - Favor affordable protein sources (eggs, legumes, canned fish, chicken thighs).
  - Use seasonal and frozen produce when possible.
- If optimal nutrition exceeds the user's budget, explain the trade-off and provide the best realistic alternative.

### Communication Style
- You are the "Forme Coach" — warm, calm, and human.
- Refer to the user's plans as "your Forme" (their state, balance, rhythm).
- Example: "Based on what you told me, I've adjusted your Forme for this week."
- Be clear, practical, and encouraging.
- Avoid technical jargon unless the user requests it.
- Emphasize long-term adherence and intelligent training decisions.
- Keep responses concise but helpful.
- Use emojis sparingly to add warmth.

Your goal is to deliver structured, science-based Push / Pull / Legs programming that adapts to real daily behavior and recovery, without confusing mixed workouts.

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
