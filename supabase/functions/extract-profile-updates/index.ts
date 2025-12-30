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
  other_sports?: string[];
  preferred_split?: string;
  experience_level?: string;
}

interface WeeklyActivityUpdate {
  activities?: string[];
  notes?: string;
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

    const extractionPrompt = `Analyze this user message and extract:
1. Fitness/nutrition PROFILE updates (permanent changes)
2. Temporary weekly activity changes
3. Direct PLAN MODIFICATION requests (change a specific meal or workout)

User message: "${message}"

====== PROFILE FIELDS (permanent changes) ======
- allergies: array of allergens (e.g., ["peanuts", "shellfish"])
- disliked_foods: array of foods user doesn't want (e.g., ["broccoli"])
- fitness_goal: one of "lose_weight", "gain_muscle", "maintain", "general_health", "strength"
- workout_location: one of "gym", "home", "outdoor"
- activity_level: one of "sedentary", "lightly_active", "moderately_active", "very_active"
- dietary_preference: one of "omnivore", "vegetarian", "vegan", "pescatarian", "keto", "paleo"
- workouts_per_week: number from 1 to 7
- other_sports: array of regular sports/activities (e.g., ["football", "running", "boxing"])
- preferred_split: workout split preference - "push_pull_legs", "upper_lower", "full_body", "bro_split"
- experience_level: "beginner", "intermediate", "advanced"

====== WEEKLY ACTIVITIES (temporary, this week only) ======
- weekly_activities: activities happening THIS WEEK that affect training
  Example: "I have a football match Saturday" → affects this week's leg volume

====== PLAN MODIFICATION REQUESTS (immediate change) ======
Detect when user wants to CHANGE their current meal or workout plan:

MEAL MODIFICATION triggers:
- "I don't want this dinner" / "change my dinner"
- "Can I eat something else for lunch?"
- "I don't like today's breakfast"
- "Give me a different meal"
- "This meal doesn't work for me"
- "Swap this meal out"

WORKOUT MODIFICATION triggers:
- "This workout is too hard" / "too intense"
- "Make it easier" / "Make this shorter"
- "I can't do this exercise"
- "Change today's workout"
- "I need an easier workout"
- "This is too much"

====== DETECTION RULES ======
1. "I prefer Push/Pull/Legs" → preferred_split: "push_pull_legs"
2. "I train one muscle per day" → preferred_split: "bro_split"
3. "I play football every weekend" → other_sports: ["football"] (permanent)
4. "I have a football match this week" → weekly_activities (temporary)
5. "This plan is too intense" / "too hard" → planModification with type "workout"
6. "I don't want this meal" → planModification with type "meal"
7. "I'm a beginner" → experience_level: "beginner"
8. "I've been training for years" → experience_level: "advanced"

====== OUTPUT FORMAT ======
Return ONLY valid JSON:
{
  "hasUpdates": true/false,
  "updates": { ...profile fields... },
  "weeklyActivities": { "activities": [...], "notes": "..." },
  "planModification": {
    "type": "meal" | "workout" | null,
    "reason": "user's reason for change",
    "context": "any specific details like which meal or what adjustment"
  },
  "needsWorkoutRegeneration": true/false,
  "needsMealRegeneration": true/false
}

If nothing relevant found: {"hasUpdates": false}

CRITICAL: 
- Plan modification requests (meal/workout) should set needsMealRegeneration or needsWorkoutRegeneration to true
- hasUpdates should be true even if ONLY a planModification is detected
- Output ONLY valid JSON, no markdown`;

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

    // Check if there's a plan modification request even without profile updates
    const planModification = extractionResult.planModification || {};
    const hasPlanModification = planModification.type === 'meal' || planModification.type === 'workout';

    if (!extractionResult.hasUpdates && !hasPlanModification) {
      return new Response(JSON.stringify({ hasUpdates: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: ProfileUpdate = extractionResult.updates || {};
    const weeklyActivities: WeeklyActivityUpdate = extractionResult.weeklyActivities || {};

    // Fetch current profile to merge arrays
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("allergies, disliked_foods, other_sports")
      .eq("id", userId)
      .single();

    // Merge arrays instead of replacing
    const mergedUpdates: Record<string, any> = { ...updates };
    
    if (updates.allergies && currentProfile?.allergies) {
      mergedUpdates.allergies = [...new Set([...currentProfile.allergies, ...updates.allergies])];
    }
    
    if (updates.disliked_foods && currentProfile?.disliked_foods) {
      mergedUpdates.disliked_foods = [...new Set([...currentProfile.disliked_foods, ...updates.disliked_foods])];
    }
    
    if (updates.other_sports && currentProfile?.other_sports) {
      mergedUpdates.other_sports = [...new Set([...currentProfile.other_sports, ...updates.other_sports])];
    }

    // Update the profile if there are updates
    if (Object.keys(mergedUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(mergedUpdates)
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
        throw new Error("Failed to update profile");
      }
      console.log("Profile updated:", mergedUpdates);
    }

    // Determine what needs regeneration (including plan modification requests)
    const needsMealRegeneration = !!(
      updates.allergies ||
      updates.disliked_foods ||
      updates.dietary_preference ||
      updates.fitness_goal ||
      planModification.type === 'meal'
    );

    const needsWorkoutRegeneration = !!(
      updates.fitness_goal ||
      updates.workout_location ||
      updates.activity_level ||
      updates.workouts_per_week ||
      updates.other_sports ||
      updates.preferred_split ||
      updates.experience_level ||
      (weeklyActivities.activities && weeklyActivities.activities.length > 0) ||
      planModification.type === 'workout'
    );

    return new Response(JSON.stringify({
      hasUpdates: true,
      updates: mergedUpdates,
      weeklyActivities,
      planModification: hasPlanModification ? planModification : undefined,
      needsMealRegeneration,
      needsWorkoutRegeneration,
      message: buildUpdateMessage(mergedUpdates, weeklyActivities, planModification),
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

interface PlanModification {
  type?: 'meal' | 'workout' | null;
  reason?: string;
  context?: string;
}

function buildUpdateMessage(updates: Record<string, any>, weeklyActivities: WeeklyActivityUpdate, planModification?: PlanModification): string {
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
  if (updates.preferred_split) {
    parts.push(`training split to ${updates.preferred_split.replace(/_/g, " ")}`);
  }
  if (updates.other_sports) {
    parts.push(`regular activities (${updates.other_sports.join(", ")})`);
  }
  if (updates.experience_level) {
    parts.push(`experience level to ${updates.experience_level}`);
  }
  if (weeklyActivities.activities && weeklyActivities.activities.length > 0) {
    parts.push(`this week's activities (${weeklyActivities.activities.join(", ")})`);
  }
  
  // Add plan modification message
  if (planModification?.type === 'meal') {
    return "Regenerating your meal plan...";
  }
  if (planModification?.type === 'workout') {
    return "Regenerating your workout program...";
  }
  
  return parts.length > 0 ? `Updated: ${parts.join(", ")}` : "";
}
