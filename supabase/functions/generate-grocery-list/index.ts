import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { meals, profile } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Generating grocery list for", meals.length, "meals");

    const systemPrompt = `You are a nutrition assistant that creates organized grocery lists.
    
Given the user's weekly meal plan, generate a comprehensive grocery list with:
1. All ingredients needed for each meal
2. Quantities/weights in grams, oz, or standard units (e.g., "2 chicken breasts", "500g rice")
3. Group items by category (Proteins, Vegetables, Fruits, Grains, Dairy, Pantry Staples, etc.)

User Profile:
- Daily Budget: $${profile?.daily_food_budget || 50}
- Dietary Preference: ${profile?.dietary_preference || "None"}
- Allergies: ${profile?.allergies?.join(", ") || "None"}

IMPORTANT:
- Consolidate duplicate ingredients across meals
- Round up quantities for practical shopping
- Include approximate prices if within budget

Return ONLY valid JSON in this format:
{
  "categories": [
    {
      "name": "Proteins",
      "items": [
        { "name": "Chicken breast", "quantity": "1kg", "estimatedPrice": 8 }
      ]
    }
  ],
  "totalEstimatedCost": 85,
  "shoppingTips": ["Buy in bulk to save money", "Check weekly sales"]
}`;

    const mealsDescription = meals.map((m: any) => 
      `${m.meal_type}: ${m.name} - ${m.description || ""}`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a grocery list for these meals:\n${mealsDescription}` },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    console.log("AI response received");

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse grocery list response");
    }

    const groceryList = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(groceryList), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating grocery list:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
