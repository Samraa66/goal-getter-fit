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

    const experienceLevel = profile.experience_level || 'beginner';
    const fitnessGoal = profile.fitness_goal || 'general_fitness';
    const workoutLocation = profile.workout_location || 'gym';
    const availableTime = profile.available_time_minutes || 60;
    const otherSports = profile.other_sports || [];
    const activityLevel = profile.activity_level || 'moderately_active';
    const workoutsPerWeek = profile.workouts_per_week || 3;
    
    // Determine training split based on experience and other activities
    let trainingSplit = "Full Body (3x/week)";
    let daysPerWeek = workoutsPerWeek;
    let setsPerMuscle = "10-12";
    
    // Reduce gym workouts if user does other sports
    const hasCardioSports = otherSports.some((s: string) => ['running', 'cycling', 'swimming', 'football', 'basketball', 'tennis', 'hiking'].includes(s));
    const hasLegIntenseSports = otherSports.some((s: string) => ['running', 'cycling', 'football', 'basketball', 'hiking', 'martial_arts'].includes(s));
    
    if (experienceLevel === 'intermediate') {
      trainingSplit = "Push/Pull/Legs (3-4x/week)";
      daysPerWeek = Math.min(workoutsPerWeek, hasCardioSports ? 3 : 4);
      setsPerMuscle = "12-16";
    } else if (experienceLevel === 'advanced') {
      trainingSplit = "Push/Pull/Legs (4-6x/week)";
      daysPerWeek = Math.min(workoutsPerWeek, hasCardioSports ? 4 : 6);
      setsPerMuscle = "16-20";
    }

    // Sports-specific adjustment guidance
    let sportsGuidance = "";
    if (otherSports.length > 0) {
      sportsGuidance = `
OTHER ACTIVITIES USER DOES: ${otherSports.join(", ")}

CRITICAL SPORT-SPECIFIC ADJUSTMENTS:
${hasLegIntenseSports ? `- User does leg-intensive sports (${otherSports.filter((s: string) => ['running', 'cycling', 'football', 'basketball', 'hiking', 'martial_arts'].includes(s)).join(', ')}). REDUCE leg workout volume by 30-40%. Avoid heavy leg days before/after sport days.` : ''}
${hasCardioSports ? `- User gets cardio from sports. SKIP separate cardio sessions in the gym program.` : ''}
- Schedule REST days around sport activities
- Prioritize upper body work if legs are taxed from sports
- Include extra mobility/recovery work for sport-specific muscles
- Consider this an HYBRID athlete, not pure gym trainee`;
    }

    // Adjust for goal
    let goalSpecificGuidance = "";
    if (fitnessGoal === 'fat_loss' || fitnessGoal === 'lose_weight') {
      goalSpecificGuidance = `
FAT LOSS SPECIFIC:
- Include 2-3 cardio sessions (HIIT or steady-state)
- Shorter rest periods (45-60 seconds)
- Higher rep ranges (12-15) for metabolic stress
- Superset exercises when possible
- Add finisher circuits at end of workouts`;
    } else if (fitnessGoal === 'muscle_gain' || fitnessGoal === 'build_muscle') {
      goalSpecificGuidance = `
MUSCLE GAIN SPECIFIC:
- Focus on progressive overload
- Longer rest periods (90-180 seconds) for strength exercises
- Mix of rep ranges: 6-8 (strength), 8-12 (hypertrophy), 12-15 (metabolic)
- Prioritize compound movements
- Include isolation work for lagging muscles`;
    } else if (fitnessGoal === 'strength') {
      goalSpecificGuidance = `
STRENGTH SPECIFIC:
- Lower rep ranges (3-6) for main lifts
- Long rest periods (3-5 minutes) between heavy sets
- Focus on Squat, Bench, Deadlift, Overhead Press
- Accessory work to support main lifts
- RIR of 1-2 on main lifts`;
    }

    const equipmentGuidance = workoutLocation === 'home' 
      ? `
HOME WORKOUT EQUIPMENT:
- Assume: bodyweight, resistance bands, possibly dumbbells
- Substitute barbell movements with dumbbell or bodyweight alternatives
- Include floor exercises, push-up variations, lunges, squats
- Use furniture for dips, rows, elevated push-ups if needed`
      : `
GYM EQUIPMENT AVAILABLE:
- Full access to barbells, dumbbells, cable machines, machines
- Include compound barbell movements (squat, deadlift, bench, row)
- Use machines for isolation and safety
- Cable exercises for constant tension`;

    const systemPrompt = `You are an elite strength & conditioning coach and certified personal trainer (CSCS, NSCA-CPT). Generate an evidence-based, periodized weekly workout program.

====== USER PROFILE ======
- Age: ${profile.age || 30} years
- Height: ${profile.height_cm || 170} cm
- Current Weight: ${profile.weight_current || 70} kg
- Goal Weight: ${profile.weight_goal || profile.weight_current || 70} kg
- Experience Level: ${experienceLevel}
- Fitness Goal: ${fitnessGoal}
- Workout Location: ${workoutLocation}
- Available Time: ${availableTime} minutes per session
- Injuries/Limitations: ${profile.injuries || 'none reported'}

====== PROGRAM DESIGN PRINCIPLES ======
Recommended Split: ${trainingSplit}
Weekly Sets Per Muscle Group: ${setsPerMuscle} sets (evidence-based hypertrophy range)
User Activity Level: ${activityLevel}
${sportsGuidance}
${goalSpecificGuidance}
${equipmentGuidance}

====== SCIENTIFIC GUIDELINES ======
1. PROGRESSIVE OVERLOAD: Each week should allow for progression (weight, reps, or sets)
2. VOLUME: ${setsPerMuscle} weekly sets per major muscle group
3. FREQUENCY: Each muscle 2-3x per week for optimal protein synthesis
4. INTENSITY: Use RIR (Reps In Reserve) to prescribe intensity
   - RIR 3-4: Warm-up/technique work
   - RIR 2-3: Hypertrophy focus
   - RIR 1-2: Strength focus
   - RIR 0-1: Max effort (use sparingly)
5. REST PERIODS:
   - Compound strength: 2-3 minutes
   - Hypertrophy: 60-90 seconds
   - Isolation: 45-60 seconds
6. EXERCISE ORDER: Compound → Isolation, Large → Small muscle groups
7. WARM-UP: Include 5-10 min cardio + dynamic stretching before each workout

====== WORKOUT STRUCTURE ======
For ${experienceLevel} level, generate a ${daysPerWeek}-day program:
${experienceLevel === 'beginner' ? `
- Day 1: Full Body A
- Day 2: Rest
- Day 3: Full Body B
- Day 4: Rest
- Day 5: Full Body C
- Day 6-7: Rest/Active Recovery` : ''}
${experienceLevel === 'intermediate' ? `
- Day 1: Push (Chest, Shoulders, Triceps)
- Day 2: Pull (Back, Biceps, Rear Delts)
- Day 3: Legs (Quads, Hamstrings, Glutes, Calves)
- Day 4: Rest
- Day 5: Push or Pull (rotating)
- Day 6-7: Rest/Active Recovery` : ''}
${experienceLevel === 'advanced' ? `
- Day 1: Push (Chest, Shoulders, Triceps)
- Day 2: Pull (Back, Biceps, Rear Delts)
- Day 3: Legs (Quads, Hamstrings, Glutes, Calves)
- Day 4: Push (Volume focus)
- Day 5: Pull (Volume focus)
- Day 6: Legs (Volume focus)
- Day 7: Rest/Active Recovery` : ''}

====== EXERCISE REQUIREMENTS ======
Each workout must include:
- ${experienceLevel === 'beginner' ? '4-6' : experienceLevel === 'intermediate' ? '5-7' : '6-8'} exercises
- Clear exercise names (use common names)
- Sets: 3-5 per exercise
- Reps: appropriate for goal (strength: 3-6, hypertrophy: 8-12, endurance: 12-15)
- RIR prescription for intensity
- Rest periods in seconds
- Brief notes for form cues or variations

====== OUTPUT FORMAT (STRICT JSON, NO MARKDOWN) ======
{
  "program_name": "Week 1: ${fitnessGoal} - ${trainingSplit}",
  "program_description": "Brief description of the program focus and expected outcomes",
  "training_split": "${trainingSplit}",
  "days_per_week": ${daysPerWeek},
  "workouts": [
    {
      "day_of_week": 0,
      "name": "Workout Name",
      "workout_type": "strength",
      "focus": "Push/Pull/Legs/Full Body/Upper/Lower",
      "duration_minutes": ${availableTime},
      "warm_up": "5 min light cardio, arm circles, leg swings, hip circles",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "8-10",
          "rir": 2,
          "rest_seconds": 90,
          "equipment": "barbell/dumbbell/bodyweight/cable/machine",
          "notes": "Form cue or variation note"
        }
      ],
      "cool_down": "5 min stretching, foam rolling"
    }
  ]
}

CRITICAL RULES:
1. day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
2. workout_type: "strength", "cardio", "flexibility", or "rest"
3. All rest days should have workout_type "rest" with minimal/no exercises
4. Fit TOTAL workout time (warm-up + exercises + rest + cool-down) within ${availableTime} minutes
5. Output ONLY valid JSON. No markdown, no explanations, no code blocks.`;

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
          { role: "user", content: "Generate a complete weekly workout program. Output ONLY valid JSON." },
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
