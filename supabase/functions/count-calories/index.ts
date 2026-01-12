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
    // SECURITY: Authenticate user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create client with user's auth context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // SECURITY: Get authenticated user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Calorie Counter: Authenticated user", user.id);

    const { image } = await req.json();

    if (!image) {
      throw new Error("No image provided");
    }

    console.log("Calorie Counter: Analyzing food image");

    const systemPrompt = `You are an expert nutritionist analyzing a photo of food to estimate its nutritional content.

YOUR TASK:
1. Identify all visible food items in the image
2. Estimate portion sizes based on visual cues
3. Calculate calorie and macro estimates as RANGES (not precise values)
4. Be honest about uncertainty - food photos can be deceiving

IMPORTANT RULES:
- Always provide estimates as RANGES (e.g., 450-550 kcal, not 500 kcal)
- Acknowledge when portions are hard to estimate
- Consider common restaurant portion sizes if it looks like restaurant food
- Consider home-cooked portions if it looks homemade
- List each identifiable food item separately

Respond with a JSON object in this exact format:
{
  "identified_foods": [
    {
      "name": "Food item name",
      "estimated_portion": "Portion description (e.g., '1 medium bowl', '~200g')",
      "calories_low": 300,
      "calories_high": 400,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "total_estimate": {
    "calories_low": 450,
    "calories_high": 550,
    "protein_low": 25,
    "protein_high": 35,
    "carbs_low": 40,
    "carbs_high": 55,
    "fats_low": 15,
    "fats_high": 22
  },
  "notes": "Any relevant notes about the estimation (e.g., 'Portion size is difficult to judge from this angle')",
  "meal_description": "A brief, friendly description of what this meal appears to be"
}

Be conservative and honest in your estimates. It's better to give a wider range than to be precise and wrong.`;

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this food photo and estimate the calories and macros. Be honest about uncertainty and provide ranges. Return your response as valid JSON.",
              },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log("Calorie Counter: Raw response received");

    // Try to parse the JSON from the response
    let analysis;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();

      const jsonStart = cleanContent.indexOf("{");
      const jsonEnd = cleanContent.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
      }

      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      analysis = {
        identified_foods: [],
        total_estimate: {
          calories_low: 0,
          calories_high: 0,
          protein_low: 0,
          protein_high: 0,
          carbs_low: 0,
          carbs_high: 0,
          fats_low: 0,
          fats_high: 0,
        },
        notes: "Could not analyze the image properly. Please try with a clearer photo.",
        meal_description: "Unable to identify the food in this image.",
      };
    }

    console.log("Calorie Counter: Analysis complete");

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Calorie Counter error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
