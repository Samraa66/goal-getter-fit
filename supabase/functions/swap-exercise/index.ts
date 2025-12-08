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
    const { currentExercise, reason, profile, workoutType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Swap Exercise: Finding alternative for", currentExercise.name, "reason:", reason);

    const systemPrompt = `You are an expert fitness trainer AI. The user cannot perform an exercise and needs an alternative.

Current Exercise: ${currentExercise.name}
Reason: ${reason === 'too_hard' ? 'Too difficult for current fitness level' : 'Unable to perform'}
Workout Type: ${workoutType || 'strength'}
User Experience: ${profile?.experience_level || 'beginner'}
Location: ${profile?.workout_location || 'gym'}

Generate ONE alternative exercise that:
1. Works the same muscle groups
2. Is EASIER or more accessible than the original
3. Requires similar or less equipment
4. Matches the user's experience level

IMPORTANT: Respond with ONLY valid JSON:
{
  "name": "Alternative Exercise Name",
  "sets": 3,
  "reps": "10-12",
  "rest_seconds": 45,
  "notes": "Brief form tip or why this is a good alternative"
}`;

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
          { role: "user", content: "Suggest an easier alternative exercise. Output ONLY valid JSON." },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI Response:", content);

    let alternativeExercise;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      alternativeExercise = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to generate alternative exercise");
    }

    console.log("Swap Exercise: Success, returning", alternativeExercise.name);

    return new Response(JSON.stringify(alternativeExercise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Swap Exercise error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
