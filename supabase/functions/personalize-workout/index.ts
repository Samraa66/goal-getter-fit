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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rl } = await adminClient.rpc("check_ai_rate_limit", { p_user_id: user.id });
    if (rl && !rl.allowed) {
      return new Response(JSON.stringify({ error: rl.message, rateLimited: true }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { templates, workoutsPerWeek, preferredSplit, otherSports } = await req.json();
    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      throw new Error("No templates provided");
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const experienceLevel = profile?.experience_level || "beginner";
    const fitnessGoal = profile?.fitness_goal || "general_health";
    const gender = profile?.gender || "not_specified";
    const weight = profile?.weight_current || 70;
    const split = preferredSplit || profile?.preferred_split || "full_body";

    // Smart template selection: group by muscle_group_focus, build balanced week
    const count = Math.min(workoutsPerWeek || 3, templates.length);
    const selected = buildBalancedSelection(templates, count, split);

    const templateDataForAI = selected.map((t: any, i: number) => ({
      template_id: t.id,
      day_index: i,
      data: t.data,
      training_stress: t.training_stress || "moderate",
      total_sets: t.total_sets || 0,
      muscle_group_focus: t.muscle_group_focus || "full_body",
      is_active_recovery: t.is_active_recovery || false,
    }));

    const sportsContext = otherSports && otherSports.length > 0
      ? `\n- Other sports/activities: ${otherSports.join(", ")} (reduce overlap with these muscle groups)`
      : "";

    const systemPrompt = `You are an elite strength coach. You will receive structured workout template JSON objects with metadata.

YOUR TASK: Modify sets, reps, and rest_seconds to match the user's experience level, goals, and weekly training stress.

USER PROFILE:
- Experience: ${experienceLevel}
- Goal: ${fitnessGoal.replace(/_/g, " ")}
- Gender: ${gender}
- Weight: ${weight} kg
- Training split: ${split}
- Workouts per week: ${count}${sportsContext}

TEMPLATE METADATA (use for context, do NOT include in output):
- training_stress: indicates how demanding the session is (low/moderate/high)
- total_sets: total volume for the session
- muscle_group_focus: which body region is targeted

RULES:
1. ONLY modify "sets", "reps", "rest_seconds" values in exercises
2. DO NOT add or remove exercises
3. DO NOT rename JSON keys
4. DO NOT remove the structure
5. Keep exercises in the same order
6. Return ONLY valid JSON array, no markdown

ADJUSTMENT GUIDELINES:
- Beginner: 2-3 sets, 10-15 reps, 90-120s rest
- Intermediate: 3-4 sets, 8-12 reps, 60-90s rest  
- Advanced: 4-5 sets, 6-10 reps, 60-90s rest
- Fat loss: higher reps (12-15), shorter rest (30-45s)
- Muscle gain: moderate reps (8-12), longer rest (60-90s)
- If training_stress is "high", keep volume but ensure adequate rest
- If is_active_recovery is true, keep sets/reps LOW (2-3 sets, light)
- For back-to-back high-stress days, slightly reduce volume on the second day

INPUT:
${JSON.stringify(templateDataForAI, null, 2)}

OUTPUT FORMAT (array of objects):
[
  {
    "template_id": "...",
    "day_index": number,
    "personalized_data": { /* modified WorkoutStructure */ }
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Personalize these workout templates. Return ONLY valid JSON array." },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI personalization failed");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (content.startsWith("```json")) content = content.slice(7);
    if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    const personalized = JSON.parse(content);
    if (!Array.isArray(personalized)) throw new Error("AI returned non-array");

    // Delete existing user workouts
    await adminClient
      .from("user_workouts")
      .delete()
      .eq("user_id", user.id);

    const dayMappings: Record<number, number[]> = {
      1: [1],
      2: [1, 4],
      3: [1, 3, 5],
      4: [1, 2, 4, 5],
      5: [1, 2, 3, 5, 6],
      6: [1, 2, 3, 4, 5, 6],
    };
    const days = dayMappings[personalized.length] || dayMappings[3];

    const today = new Date().toISOString().split("T")[0];
    const inserts = personalized.map((p: any, i: number) => ({
      user_id: user.id,
      base_template_id: p.template_id,
      personalized_data: p.personalized_data,
      date_assigned: today,
      day_of_week: days[i] || i + 1,
    }));

    const { error: insertErr } = await adminClient
      .from("user_workouts")
      .insert(inserts);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Failed to save personalized workouts");
    }

    return new Response(JSON.stringify({ success: true, count: inserts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Personalize Workout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Something went wrong" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Build a balanced selection of templates for the week based on split */
function buildBalancedSelection(templates: any[], count: number, split: string): any[] {
  const regular = templates.filter((t: any) => !t.is_active_recovery);
  const recovery = templates.filter((t: any) => t.is_active_recovery);

  const byFocus: Record<string, any[]> = {};
  for (const t of regular) {
    const focus = t.muscle_group_focus || "full_body";
    if (!byFocus[focus]) byFocus[focus] = [];
    byFocus[focus].push(t);
  }

  const selected: any[] = [];
  const rotations: Record<string, string[]> = {
    ppl: ["push", "pull", "lower"],
    upper_lower: ["upper", "lower"],
    bro_split: ["push", "pull", "push", "legs"],
    full_body: ["full_body"],
  };

  const rotation = rotations[split] || rotations["full_body"];

  for (let i = 0; i < count && i < 6; i++) {
    const focus = rotation[i % rotation.length];
    const pool = byFocus[focus] || regular;
    if (pool.length > 0) {
      const unused = pool.filter((t: any) => !selected.includes(t));
      const source = unused.length > 0 ? unused : pool;
      selected.push(source[Math.floor(Math.random() * source.length)]);
    }
  }

  // Pad if needed
  if (selected.length < count) {
    const remaining = regular.filter((t: any) => !selected.includes(t));
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    for (const t of shuffled) {
      if (selected.length >= count) break;
      selected.push(t);
    }
  }

  return selected.slice(0, count);
}
