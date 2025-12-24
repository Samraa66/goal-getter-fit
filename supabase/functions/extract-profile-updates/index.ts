import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileUpdate {
  allergies?: string[];
  disliked_foods?: string[];
  fitness_goal?: string;
  workout_location?: string;
  activity_level?: string;
  dietary_preference?: string;
  workouts_per_week?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Extract Profile Updates: Analyzing message for user", userId);

    // Use AI to extract structured data from the user message
    const extractionPrompt = `Analyze this user message and extract any fitness/nutrition profile updates. Return a JSON object with ONLY the fields that the user explicitly mentioned they want to change.

User message: "${message}"

Possible fields to extract:
- allergies: array of allergens (e.g., ["peanuts", "shellfish", "dairy"])
- disliked_foods: array of foods the user doesn't want (e.g., ["broccoli", "fish"])
- fitness_goal: one of "lose_weight", "gain_muscle", "maintain", "general_health"
- workout_location: one of "gym", "home", "outdoor"
- activity_level: one of "sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"
- dietary_preference: one of "omnivore", "vegetarian", "vegan", "pescatarian", "keto", "paleo"
- workouts_per_week: number from 1 to 7

RULES:
1. ONLY include fields that the user explicitly mentioned
2. If user says "I'm allergic to X", add X to allergies array
3. If user says "I don't like X" or "I hate X", add X to disliked_foods
4. If user mentions changing workout frequency, set workouts_per_week
5. Return ONLY valid JSON, no markdown, no explanation
6. If nothing relevant is found, return: {"hasUpdates": false}
7. If updates found, return: {"hasUpdates": true, "updates": {...}}

Examples:
- "I'm allergic to peanuts and shellfish" → {"hasUpdates": true, "updates": {"allergies": ["peanuts", "shellfish"]}}
- "I hate broccoli" → {"hasUpdates": true, "updates": {"disliked_foods": ["broccoli"]}}
- "I can only work out 3 days a week now" → {"hasUpdates": true, "updates": {"workouts_per_week": 3}}
- "What's a good breakfast?" → {"hasUpdates": false}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: extractionPrompt },
          { role: "user", content: "Analyze and extract" },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("Extraction result:", content);

    if (!content) {
      return new Response(JSON.stringify({ hasUpdates: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the extraction result
    let extractionResult;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();
      
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
      }
      
      extractionResult = JSON.parse(cleanContent);
    } catch (e) {
      console.log("No valid extraction result");
      return new Response(JSON.stringify({ hasUpdates: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!extractionResult.hasUpdates || !extractionResult.updates) {
      return new Response(JSON.stringify({ hasUpdates: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: ProfileUpdate = extractionResult.updates;

    // Fetch current profile to merge arrays
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("allergies, disliked_foods")
      .eq("id", userId)
      .single();

    // Merge arrays instead of replacing
    const mergedUpdates: Record<string, any> = { ...updates };
    
    if (updates.allergies && currentProfile?.allergies) {
      const combined = [...new Set([...currentProfile.allergies, ...updates.allergies])];
      mergedUpdates.allergies = combined;
    }
    
    if (updates.disliked_foods && currentProfile?.disliked_foods) {
      const combined = [...new Set([...currentProfile.disliked_foods, ...updates.disliked_foods])];
      mergedUpdates.disliked_foods = combined;
    }

    // Update the profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update(mergedUpdates)
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      throw new Error("Failed to update profile");
    }

    console.log("Profile updated successfully:", mergedUpdates);

    // Determine what needs regeneration
    const needsMealRegeneration = !!(
      updates.allergies ||
      updates.disliked_foods ||
      updates.dietary_preference ||
      updates.fitness_goal
    );

    const needsWorkoutRegeneration = !!(
      updates.fitness_goal ||
      updates.workout_location ||
      updates.activity_level ||
      updates.workouts_per_week
    );

    return new Response(JSON.stringify({
      hasUpdates: true,
      updates: mergedUpdates,
      needsMealRegeneration,
      needsWorkoutRegeneration,
      message: buildUpdateMessage(mergedUpdates),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Extract Profile Updates error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildUpdateMessage(updates: Record<string, any>): string {
  const parts: string[] = [];
  
  if (updates.allergies) {
    parts.push(`allergies (${updates.allergies.join(", ")})`);
  }
  if (updates.disliked_foods) {
    parts.push(`food preferences`);
  }
  if (updates.fitness_goal) {
    parts.push(`fitness goal to ${updates.fitness_goal.replace(/_/g, " ")}`);
  }
  if (updates.workout_location) {
    parts.push(`workout location to ${updates.workout_location}`);
  }
  if (updates.workouts_per_week) {
    parts.push(`workouts to ${updates.workouts_per_week}x per week`);
  }
  if (updates.dietary_preference) {
    parts.push(`diet to ${updates.dietary_preference}`);
  }
  
  return parts.length > 0 ? `Updated your profile: ${parts.join(", ")}` : "";
}
