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
    const { image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!image) {
      throw new Error("No image provided");
    }

    console.log("Menu Scanner: Analyzing menu image");

    const systemPrompt = `You are an expert nutritionist analyzing a restaurant menu image. Your task is to:

1. Read and understand the menu items
2. Identify healthy options based on general fitness goals
3. Suggest modifications to make dishes healthier

Respond with a JSON object in this exact format:
{
  "summary": "Brief summary of the menu type and cuisine",
  "healthyChoices": [
    {
      "name": "Dish name",
      "reason": "Why it's a good choice",
      "modifications": ["Optional modification suggestions"]
    }
  ],
  "recommendation": {
    "name": "Best overall choice",
    "reason": "Why this is the top pick"
  }
}

Focus on:
- High protein options
- Low calorie alternatives
- Dishes that can be easily modified
- Balanced nutrition

Keep explanations concise and practical.`;

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
                text: "Analyze this restaurant menu and identify the healthiest options. Return your response as valid JSON.",
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log("Menu Scanner: Raw response:", content);

    // Try to parse the JSON from the response
    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // Return a fallback structure
      analysis = {
        summary: content || "Could not analyze the menu properly.",
        healthyChoices: [],
        recommendation: {
          name: "Unable to determine",
          reason: "Please try with a clearer image of the menu.",
        },
      };
    }

    console.log("Menu Scanner: Analysis complete");

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Menu Scanner error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
