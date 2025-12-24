import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Standard workout types that users understand
const WORKOUT_TYPES = {
  PUSH: "push",
  PULL: "pull", 
  LEGS: "legs",
  CHEST: "chest",
  BACK: "back",
  SHOULDERS: "shoulders",
  ARMS: "arms",
  UPPER: "upper",
  LOWER: "lower",
  FULL_BODY: "full_body",
  CARDIO: "cardio",
  REST: "rest",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, weeklyActivities } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generate Workout Program: Creating personalized program");

    // ===== USER PROFILE DATA =====
    const age = profile.age || 30;
    const heightCm = profile.height_cm || 170;
    const weightKg = profile.weight_current || 70;
    const goalWeightKg = profile.weight_goal || weightKg;
    const gender = profile.gender || 'not_specified';
    const experienceLevel = profile.experience_level || 'beginner';
    const fitnessGoal = profile.fitness_goal || 'general_fitness';
    const workoutLocation = profile.workout_location || 'gym';
    const availableTime = profile.available_time_minutes || 60;
    const otherSports = profile.other_sports || [];
    const activityLevel = profile.activity_level || 'moderately_active';
    const workoutsPerWeek = Math.min(profile.workouts_per_week || 3, 6);
    const preferredSplit = profile.preferred_split || null; // User can set via Coach AI
    
    // ===== CALCULATE TRAINING PARAMETERS =====
    
    // Base volume adjustment by experience
    const volumeMap: Record<string, number> = {
      beginner: 0.6,
      intermediate: 1.0,
      advanced: 1.3,
    };
    const volumeMultiplier = volumeMap[experienceLevel] || 0.8;
    
    // Intensity adjustment by body weight and gender
    const baseIntensity = gender === 'female' ? 0.85 : 1.0;
    const weightFactor = weightKg < 60 ? 0.8 : weightKg > 90 ? 1.15 : 1.0;
    const intensityMultiplier = baseIntensity * weightFactor * volumeMultiplier;
    
    // Sets per muscle group per week (evidence-based hypertrophy)
    const baseSetsPerMuscle = experienceLevel === 'beginner' ? 8 
      : experienceLevel === 'intermediate' ? 12 
      : 16;
    
    // ===== SPORT-SPECIFIC ADJUSTMENTS =====
    const sportsImpact = analyzeSportsImpact(otherSports, weeklyActivities);
    
    // ===== DETERMINE TRAINING SPLIT =====
    const { split, daysPerWeek, workoutStructure } = determineTrainingSplit(
      experienceLevel,
      workoutsPerWeek,
      preferredSplit,
      sportsImpact
    );
    
    console.log(`Selected split: ${split}, ${daysPerWeek} days/week`);
    console.log(`Sports impact:`, sportsImpact);

    // ===== BUILD AI PROMPT =====
    const systemPrompt = `You are an elite strength & conditioning coach. Generate a practical, gym-culture-aligned workout program.

====== USER PROFILE ======
- Age: ${age} years
- Gender: ${gender}
- Height: ${heightCm} cm  
- Weight: ${weightKg} kg (Goal: ${goalWeightKg} kg)
- Experience: ${experienceLevel.toUpperCase()}
- Goal: ${fitnessGoal}
- Location: ${workoutLocation}
- Time per session: ${availableTime} minutes
- Activity level: ${activityLevel}

====== CALCULATED PARAMETERS ======
- Training Split: ${split}
- Days per week: ${daysPerWeek}
- Intensity multiplier: ${intensityMultiplier.toFixed(2)} (affects weight/volume)
- Base sets per muscle: ${baseSetsPerMuscle} sets/week
- Volume adjusted for experience: ${Math.round(baseSetsPerMuscle * volumeMultiplier)} sets/week

====== TRAINING SPLIT STRUCTURE ======
${workoutStructure}

====== SPORTS & WEEKLY ACTIVITIES ======
${sportsImpact.guidance}

====== CRITICAL RULES ======
1. USE STANDARD WORKOUT NAMES:
   - "Push" (Chest, Shoulders, Triceps)
   - "Pull" (Back, Biceps, Rear Delts)
   - "Legs" (Quads, Hamstrings, Glutes, Calves)
   - "Chest", "Back", "Shoulders", "Arms" for bro splits
   - "Upper Body", "Lower Body" for upper/lower splits
   - NEVER use "Full Body A/B/C" or confusing labels

2. ADJUST VOLUME FOR USER:
   - Beginner (${weightKg < 70 ? 'lighter' : 'standard'} weight): ${Math.round(baseSetsPerMuscle * 0.6)} sets/muscle, 3-4 exercises/workout
   - Intermediate: ${Math.round(baseSetsPerMuscle * 1.0)} sets/muscle, 5-6 exercises/workout  
   - Advanced: ${Math.round(baseSetsPerMuscle * 1.3)} sets/muscle, 6-8 exercises/workout

3. ${gender === 'female' ? 'FEMALE-SPECIFIC: Focus on glutes, legs, and functional movements. Slightly lower upper body volume. Include hip thrusts, RDLs, glute bridges.' : 'MALE-SPECIFIC: Balanced upper/lower. Include bench, rows, squats, deadlifts.'}

4. ${sportsImpact.hasLegSports ? 'REDUCE LEG VOLUME by 30-40% due to leg-intensive sports.' : ''}
${sportsImpact.hasArmSports ? 'REDUCE PUSHING VOLUME by 20-30% due to arm-intensive sports (boxing, climbing).' : ''}
${sportsImpact.hasCardioSports ? 'SKIP SEPARATE CARDIO - user gets it from sports.' : ''}

5. INTENSITY BY WEIGHT CLASS:
   - Light (<60kg): Conservative weights, focus on form, more reps (10-15)
   - Medium (60-90kg): Standard progression, mixed reps (8-12)
   - Heavy (>90kg): Can handle more volume, lower reps for compounds (6-10)

====== OUTPUT FORMAT (STRICT JSON) ======
{
  "program_name": "${split} - ${fitnessGoal.replace(/_/g, ' ')}",
  "program_description": "Brief 1-2 sentence description",
  "training_split": "${split}",
  "days_per_week": ${daysPerWeek},
  "workouts": [
    {
      "day_of_week": 1,
      "name": "Push",
      "workout_type": "push",
      "duration_minutes": ${availableTime},
      "exercises": [
        {
          "name": "Bench Press",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "notes": "Control the descent"
        }
      ]
    }
  ]
}

workout_type MUST be one of: "push", "pull", "legs", "chest", "back", "shoulders", "arms", "upper", "lower", "full_body", "cardio", "rest"
day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday

Output ONLY valid JSON. No markdown, no code blocks, no explanation.`;

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
          { role: "user", content: `Generate a ${daysPerWeek}-day ${split} workout program. Output ONLY valid JSON.` },
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
    
    console.log("AI Response received, parsing...");

    // Parse JSON response
    let workoutProgram;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      else if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      workoutProgram = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content:", content);
      throw new Error("Failed to generate valid workout program");
    }

    // Normalize workout types to ensure consistency
    if (workoutProgram.workouts) {
      workoutProgram.workouts = workoutProgram.workouts.map((workout: any) => ({
        ...workout,
        workout_type: normalizeWorkoutType(workout.workout_type || workout.name),
      }));
    }

    console.log("Generate Workout Program: Success -", workoutProgram.workouts?.length, "workouts");

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

// ===== HELPER FUNCTIONS =====

function analyzeSportsImpact(otherSports: string[], weeklyActivities?: any) {
  const allActivities = [...otherSports, ...(weeklyActivities?.activities || [])];
  
  const legIntenseSports = ['running', 'cycling', 'football', 'soccer', 'basketball', 'hiking', 'skiing', 'skating', 'martial_arts', 'kickboxing'];
  const armIntenseSports = ['boxing', 'climbing', 'swimming', 'tennis', 'volleyball', 'rock_climbing'];
  const cardioSports = ['running', 'cycling', 'swimming', 'football', 'basketball', 'tennis', 'hiking'];
  
  const hasLegSports = allActivities.some(s => legIntenseSports.includes(s.toLowerCase()));
  const hasArmSports = allActivities.some(s => armIntenseSports.includes(s.toLowerCase()));
  const hasCardioSports = allActivities.some(s => cardioSports.includes(s.toLowerCase()));
  
  let guidance = "";
  if (allActivities.length === 0) {
    guidance = "No other sports reported. Full gym program recommended.";
  } else {
    guidance = `User also does: ${allActivities.join(", ")}\n`;
    if (hasLegSports) guidance += "- REDUCE leg workout volume to prevent overtraining\n";
    if (hasArmSports) guidance += "- REDUCE pushing/pulling volume for arm recovery\n";
    if (hasCardioSports) guidance += "- SKIP cardio sessions - sports provide sufficient conditioning\n";
    guidance += "- Schedule gym sessions to avoid back-to-back with sport activities";
  }
  
  return { hasLegSports, hasArmSports, hasCardioSports, guidance };
}

function determineTrainingSplit(
  experience: string,
  requestedDays: number,
  preferredSplit: string | null,
  sportsImpact: any
) {
  // If user explicitly chose a split via Coach AI, respect it
  if (preferredSplit) {
    return buildSplitFromPreference(preferredSplit, requestedDays);
  }
  
  // Default logic based on experience and availability
  if (experience === 'beginner') {
    // Beginners: Full Body 2-3x/week OR Push/Pull/Legs light
    if (requestedDays <= 3) {
      return {
        split: "Full Body",
        daysPerWeek: Math.min(requestedDays, 3),
        workoutStructure: `
Day 1 (Mon): Full Body - Focus on compound movements
Day 2 (Wed): Full Body - Slightly different exercise selection  
Day 3 (Fri): Full Body - Light/technique focus
- Keep exercises simple: Squat, Bench, Row, Deadlift variations
- 3-4 sets per exercise, 10-12 reps
- Full body ensures each muscle trained 3x/week for beginners`
      };
    } else {
      return {
        split: "Push/Pull/Legs",
        daysPerWeek: Math.min(requestedDays, 4),
        workoutStructure: `
Day 1 (Mon): Push - Chest, Shoulders, Triceps
Day 2 (Tue): Pull - Back, Biceps
Day 3 (Thu): Legs - Quads, Hamstrings, Glutes
Day 4 (Sat): Optional Upper Body light session
- 4-5 exercises per session for beginner
- Focus on learning proper form`
      };
    }
  }
  
  if (experience === 'intermediate') {
    // Intermediate: Classic Push/Pull/Legs
    const adjustedDays = sportsImpact.hasCardioSports ? Math.min(requestedDays, 4) : requestedDays;
    
    if (adjustedDays <= 3) {
      return {
        split: "Push/Pull/Legs",
        daysPerWeek: 3,
        workoutStructure: `
Day 1 (Mon): Push - Chest, Shoulders, Triceps (5-6 exercises)
Day 2 (Wed): Pull - Back, Biceps, Rear Delts (5-6 exercises)
Day 3 (Fri): Legs - Quads, Hamstrings, Glutes, Calves (5-6 exercises)
- Each muscle hit 1x/week with sufficient volume
- Focus on progressive overload week-to-week`
      };
    } else if (adjustedDays <= 5) {
      return {
        split: "Push/Pull/Legs",
        daysPerWeek: adjustedDays,
        workoutStructure: `
Day 1 (Mon): Push - Heavy emphasis
Day 2 (Tue): Pull - Heavy emphasis
Day 3 (Wed): Legs  
Day 4 (Thu): Rest
Day 5 (Fri): Push/Pull combo or weak point focus
- Each muscle hit 1.5-2x/week
- Rotate emphasis between strength and hypertrophy`
      };
    } else {
      return {
        split: "Push/Pull/Legs",
        daysPerWeek: 6,
        workoutStructure: `
Day 1 (Mon): Push - Strength focus
Day 2 (Tue): Pull - Strength focus
Day 3 (Wed): Legs - Strength focus
Day 4 (Thu): Push - Hypertrophy focus
Day 5 (Fri): Pull - Hypertrophy focus  
Day 6 (Sat): Legs - Hypertrophy focus
Day 7 (Sun): Rest
- Each muscle hit 2x/week with varied rep ranges`
      };
    }
  }
  
  // Advanced: PPL or Bro Split based on days
  if (requestedDays >= 5) {
    return {
      split: "Push/Pull/Legs",
      daysPerWeek: Math.min(requestedDays, 6),
      workoutStructure: `
Day 1: Push - Heavy compounds + isolation
Day 2: Pull - Heavy compounds + isolation
Day 3: Legs - Quad focus
Day 4: Push - Volume/pump focus
Day 5: Pull - Volume/pump focus
Day 6: Legs - Hamstring/Glute focus
- High volume, high frequency for advanced gains
- Include intensity techniques: drop sets, rest-pause`
    };
  } else {
    return {
      split: "Upper/Lower",
      daysPerWeek: 4,
      workoutStructure: `
Day 1 (Mon): Upper Body - Push emphasis
Day 2 (Tue): Lower Body - Quad emphasis
Day 3 (Thu): Upper Body - Pull emphasis
Day 4 (Fri): Lower Body - Posterior chain emphasis
- Great frequency for intermediate-advanced
- Balances volume and recovery`
    };
  }
}

function buildSplitFromPreference(preferredSplit: string, days: number) {
  const normalized = preferredSplit.toLowerCase().replace(/[\/\s-]+/g, '_');
  
  if (normalized.includes('push') && normalized.includes('pull')) {
    return {
      split: "Push/Pull/Legs",
      daysPerWeek: Math.min(days, 6),
      workoutStructure: "User preference: Push/Pull/Legs split"
    };
  }
  
  if (normalized.includes('upper') && normalized.includes('lower')) {
    return {
      split: "Upper/Lower", 
      daysPerWeek: Math.min(days, 4),
      workoutStructure: "User preference: Upper/Lower split"
    };
  }
  
  if (normalized.includes('bro') || normalized.includes('body_part')) {
    return {
      split: "Body Part Split",
      daysPerWeek: Math.min(days, 5),
      workoutStructure: "User preference: One muscle group per day"
    };
  }
  
  if (normalized.includes('full')) {
    return {
      split: "Full Body",
      daysPerWeek: Math.min(days, 3),
      workoutStructure: "User preference: Full body workouts"
    };
  }
  
  // Default to PPL
  return {
    split: "Push/Pull/Legs",
    daysPerWeek: Math.min(days, 6),
    workoutStructure: "Default: Push/Pull/Legs split"
  };
}

function normalizeWorkoutType(type: string): string {
  const normalized = type.toLowerCase().replace(/[\s-]+/g, '_');
  
  // Map all workout types to the allowed database values: strength, cardio, flexibility, rest
  // The visual display name is handled separately in the UI via the workout name field
  const typeMap: Record<string, string> = {
    'push': 'strength',
    'pushing': 'strength',
    'chest_shoulders_triceps': 'strength',
    'pull': 'strength',
    'pulling': 'strength',
    'back_biceps': 'strength',
    'legs': 'strength',
    'leg': 'strength',
    'lower_body': 'strength',
    'lower': 'strength',
    'upper_body': 'strength',
    'upper': 'strength',
    'full_body': 'strength',
    'full': 'strength',
    'chest': 'strength',
    'back': 'strength',
    'shoulders': 'strength',
    'arms': 'strength',
    'cardio': 'cardio',
    'rest': 'rest',
    'recovery': 'rest',
    'strength': 'strength',
    'flexibility': 'flexibility',
    'stretching': 'flexibility',
    'yoga': 'flexibility',
  };
  
  return typeMap[normalized] || 'strength';
}
