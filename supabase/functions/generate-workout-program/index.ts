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
    const { profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generate Workout Program: Creating program for user");

    const systemPrompt = `You are an expert fitness trainer AI. Generate a personalized weekly workout program based on the user's profile.

User Profile:
- Fitness Goal: ${profile.fitness_goal || 'general fitness'}
- Experience Level: ${profile.experience_level || 'beginner'}
- Workout Location: ${profile.workout_location || 'gym'}

Generate a 7-day workout program with one workout per day. Include rest/recovery days.

IMPORTANT: You must respond with ONLY valid JSON, no markdown, no explanation. Use this exact format:
{
  "program_name": "Week 1: Getting Started",
  "program_description": "A balanced program for beginners",
  "workouts": [
    {
      "day_of_week": 0,
      "name": "Upper Body Strength",
      "workout_type": "strength",
      "duration_minutes": 45,
      "exercises": [
        {
          "name": "Push-ups",
          "sets": 3,
          "reps": "10-12",
          "rest_seconds": 60,
          "notes": "Keep core tight"
        }
      ]
    }
  ]
}

Guidelines:
- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
- workout_type must be one of: "strength", "cardio", "flexibility"
- Include 1-2 rest/recovery days with flexibility workouts
- For ${profile.experience_level || 'beginner'}: ${profile.experience_level === 'advanced' ? '5-7 exercises per workout' : profile.experience_level === 'intermediate' ? '4-6 exercises' : '3-5 exercises'}
- Tailor exercises for ${profile.workout_location || 'gym'} setting
- Focus on ${profile.fitness_goal || 'general fitness'} goal`;

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
          { role: "user", content: "Generate a weekly workout program. Remember to output ONLY valid JSON." },
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

    // Parse the JSON response
    let workoutProgram;
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
      workoutProgram = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to generate valid workout program");
    }

    console.log("Generate Workout Program: Success, returning", workoutProgram.workouts?.length, "workouts");

    return new Response(JSON.stringify(workoutProgram), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate Workout Program error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
