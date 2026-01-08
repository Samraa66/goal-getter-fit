import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Standard workout types
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
    // SECURITY: Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Create client with user's auth context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // SECURITY: Get authenticated user from JWT - never trust client-supplied userId
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id; // SECURITY: Always use authenticated user's ID

    // RATE LIMITING: Check per-user AI generation limits
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rateLimitResult, error: rateLimitError } = await adminClient.rpc('check_ai_rate_limit', {
      p_user_id: userId
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log("Rate limit exceeded for user:", userId, rateLimitResult);
      return new Response(JSON.stringify({ 
        error: rateLimitResult.message || "You've reached today's AI limit. Try again tomorrow.",
        rateLimited: true,
        errorType: rateLimitResult.error
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let profile = body.profile;
    const weeklyActivities = body.weeklyActivities;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch profile from database using authenticated user's ID
    if (!profile) {
      console.log("Generate Workout Program: Fetching profile for authenticated user", userId);
      const { data: fetchedProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (error) {
        console.error("Failed to fetch profile:", error);
        throw new Error("Could not fetch user profile");
      }
      profile = fetchedProfile;
    }

    if (!profile) {
      throw new Error("Profile data is required");
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
    const preferredSplit = profile.preferred_split || null;
    
    // ===== GENDER-BASED ADJUSTMENTS =====
    let genderNotes = "";
    let volumeAdjustment = 1.0;
    let recoveryNotes = "";
    
    if (gender === 'female') {
      genderNotes = `
FEMALE-SPECIFIC PROGRAMMING:
- Women generally recover faster between sets - can use shorter rest periods (60-90s)
- Higher rep tolerance - can handle slightly higher volume
- Include hip thrusts, glute bridges, RDLs as staples
- Don't neglect upper body - include bench, rows, overhead press
- No need to train differently during menstrual cycle unless user mentions fatigue`;
      recoveryNotes = "Faster inter-set recovery, can handle more weekly volume";
    } else if (gender === 'male') {
      genderNotes = `
MALE-SPECIFIC PROGRAMMING:
- Standard rest periods (90-120s for compounds, 60-90s for isolation)
- Emphasize compound strength movements
- Include bench press, squats, deadlifts, rows, overhead press
- Progressive overload focus`;
      recoveryNotes = "Standard recovery protocols";
    } else {
      genderNotes = `
NEUTRAL PROGRAMMING (gender not specified):
- Use moderate rest periods (90s compounds, 60s isolation)
- Balanced full-body approach
- Include major compound movements
- Focus on individual preferences and goals`;
      recoveryNotes = "Standard recovery protocols";
    }
    
    // ===== CALCULATE TRAINING PARAMETERS =====
    const volumeMap: Record<string, number> = {
      beginner: 0.6,
      intermediate: 1.0,
      advanced: 1.3,
    };
    const volumeMultiplier = volumeMap[experienceLevel] || 0.8;
    
    const baseIntensity = gender === 'female' ? 0.9 : 1.0;
    const weightFactor = weightKg < 60 ? 0.8 : weightKg > 90 ? 1.15 : 1.0;
    const intensityMultiplier = baseIntensity * weightFactor * volumeMultiplier;
    
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
    
    console.log(`Selected split: ${split}, ${daysPerWeek} days/week, gender: ${gender}`);

    // ===== BUILD AI PROMPT =====
    const systemPrompt = `You are an elite strength & conditioning coach. Generate a practical, gym-culture-aligned workout program.

====== USER PROFILE ======
- Age: ${age} years
- Gender: ${gender === 'non_binary' ? 'not specified' : gender}
- Height: ${heightCm} cm  
- Weight: ${weightKg} kg (Goal: ${goalWeightKg} kg)
- Experience: ${experienceLevel.toUpperCase()}
- Goal: ${fitnessGoal.replace(/_/g, ' ')}
- Location: ${workoutLocation}
- Time per session: ${availableTime} minutes
- Activity level: ${activityLevel.replace(/_/g, ' ')}

====== CALCULATED PARAMETERS ======
- Training Split: ${split}
- Days per week: ${daysPerWeek}
- Intensity multiplier: ${intensityMultiplier.toFixed(2)}
- Base sets per muscle: ${baseSetsPerMuscle} sets/week
- Volume adjusted for experience: ${Math.round(baseSetsPerMuscle * volumeMultiplier)} sets/week
${genderNotes}

====== TRAINING SPLIT STRUCTURE ======
${workoutStructure}

====== SPORTS & WEEKLY ACTIVITIES ======
${sportsImpact.guidance}
${recoveryNotes}

====== CRITICAL RULES ======
1. USE STANDARD WORKOUT NAMES:
   - "Push" (Chest, Shoulders, Triceps)
   - "Pull" (Back, Biceps, Rear Delts)
   - "Legs" (Quads, Hamstrings, Glutes, Calves)
   - "Upper Body", "Lower Body" for upper/lower splits
   - NEVER use confusing labels like "Full Body A/B/C"

2. ADJUST VOLUME FOR USER:
   - Beginner: 3-4 exercises/workout, higher reps (10-15)
   - Intermediate: 5-6 exercises/workout, mixed reps (8-12)
   - Advanced: 6-8 exercises/workout, varied rep ranges

3. ${sportsImpact.hasLegSports ? 'REDUCE LEG VOLUME by 30-40% due to leg-intensive sports.' : ''}
${sportsImpact.hasArmSports ? 'REDUCE PUSHING VOLUME by 20-30% due to arm-intensive sports.' : ''}
${sportsImpact.hasCardioSports ? 'SKIP SEPARATE CARDIO - user gets it from sports.' : ''}

====== CRITICAL DAY ASSIGNMENT RULES ======
- Start the FIRST workout on Monday (day_of_week: 1)
- NEVER generate rest days as workouts - just skip those days
- ONLY output actual training days with exercises
- Spread workouts across the week starting from Monday

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

workout_type MUST be one of: "push", "pull", "legs", "chest", "back", "shoulders", "arms", "upper", "lower", "full_body", "cardio"
DO NOT include "rest" type workouts - only actual training days with exercises.
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
        return new Response(JSON.stringify({ error: "We're experiencing high demand. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
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
      throw new Error("Failed to generate workout program. Please try again.");
    }

    // Normalize workout types, filter out rest days, and ensure proper day assignment
    if (workoutProgram.workouts) {
      let validWorkouts = workoutProgram.workouts
        .filter((workout: any) => {
          const type = (workout.workout_type || workout.name || '').toLowerCase();
          if (type === 'rest' || type === 'recovery' || type.includes('rest day')) {
            return false;
          }
          if (!workout.exercises || workout.exercises.length === 0) {
            return false;
          }
          return true;
        })
        .map((workout: any) => ({
          ...workout,
          workout_type: normalizeWorkoutType(workout.workout_type || workout.name),
        }));

      // CRITICAL: Day 1 MUST have an active workout, never rest
      // Day mappings ensure first workout is always Monday (day 1)
      const dayMappings: Record<number, number[]> = {
        1: [1],           // Single workout: Monday
        2: [1, 4],        // 2 workouts: Mon, Thu
        3: [1, 3, 5],     // 3 workouts: Mon, Wed, Fri
        4: [1, 2, 4, 5],  // 4 workouts: Mon, Tue, Thu, Fri
        5: [1, 2, 3, 5, 6], // 5 workouts: Mon-Wed, Fri-Sat
        6: [1, 2, 3, 4, 5, 6], // 6 workouts: Mon-Sat
      };

      const numWorkouts = validWorkouts.length;
      const targetDays = dayMappings[numWorkouts] || dayMappings[3];

      // Assign days ensuring day 1 (Monday) always gets the first active workout
      validWorkouts = validWorkouts.map((workout: any, index: number) => ({
        ...workout,
        day_of_week: targetDays[index] !== undefined ? targetDays[index] : (index + 1),
      }));

      // SAFETY CHECK: Ensure day 1 has an active workout
      const hasDay1Workout = validWorkouts.some((w: any) => w.day_of_week === 1);
      if (!hasDay1Workout && validWorkouts.length > 0) {
        // Force first workout to be on day 1
        validWorkouts[0].day_of_week = 1;
        console.log("SAFETY: Forced first workout to day 1 to prevent rest day start");
      }

      // Extra validation: if first workout is somehow rest-like, replace it
      if (validWorkouts.length > 0) {
        const firstWorkout = validWorkouts.find((w: any) => w.day_of_week === 1);
        if (firstWorkout) {
          const firstType = (firstWorkout.workout_type || '').toLowerCase();
          if (firstType === 'rest' || firstType.includes('rest') || firstType.includes('recovery')) {
            // Convert to active recovery / mobility
            firstWorkout.workout_type = 'full_body';
            firstWorkout.name = 'Active Recovery - Mobility';
            console.log("SAFETY: Converted day 1 rest to active recovery");
          }
        }
      }

      workoutProgram.workouts = validWorkouts;
    }

    console.log("Generate Workout Program: Success -", workoutProgram.workouts?.length, "workouts");

    return new Response(JSON.stringify(workoutProgram), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate Workout Program error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
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
  if (preferredSplit) {
    return buildSplitFromPreference(preferredSplit, requestedDays);
  }
  
  if (experience === 'beginner') {
    if (requestedDays <= 3) {
      return {
        split: "Full Body",
        daysPerWeek: Math.min(requestedDays, 3),
        workoutStructure: `
Day 1 (Mon): Full Body - Focus on compound movements
Day 2 (Wed): Full Body - Slightly different exercise selection  
Day 3 (Fri): Full Body - Light/technique focus
- Keep exercises simple: Squat, Bench, Row, Deadlift variations
- 3-4 sets per exercise, 10-12 reps`
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
- 4-5 exercises per session for beginner`
      };
    }
  }
  
  if (experience === 'intermediate') {
    const adjustedDays = sportsImpact.hasCardioSports ? Math.min(requestedDays, 4) : requestedDays;
    
    if (adjustedDays <= 3) {
      return {
        split: "Push/Pull/Legs",
        daysPerWeek: 3,
        workoutStructure: `
Day 1 (Mon): Push - Chest, Shoulders, Triceps (5-6 exercises)
Day 2 (Wed): Pull - Back, Biceps, Rear Delts (5-6 exercises)
Day 3 (Fri): Legs - Quads, Hamstrings, Glutes, Calves (5-6 exercises)`
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
Day 5 (Fri): Push/Pull combo or weak point focus`
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
Day 6 (Sat): Legs - Hypertrophy focus`
      };
    }
  }
  
  // Advanced
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
Day 6: Legs - Hamstring/Glute focus`
    };
  } else {
    return {
      split: "Upper/Lower",
      daysPerWeek: 4,
      workoutStructure: `
Day 1 (Mon): Upper Body - Push emphasis
Day 2 (Tue): Lower Body - Quad emphasis
Day 3 (Thu): Upper Body - Pull emphasis
Day 4 (Fri): Lower Body - Posterior chain emphasis`
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
  
  if (normalized.includes('full') && normalized.includes('body')) {
    return {
      split: "Full Body",
      daysPerWeek: Math.min(days, 3),
      workoutStructure: "User preference: Full Body split"
    };
  }
  
  if (normalized.includes('bro')) {
    return {
      split: "Bro Split",
      daysPerWeek: Math.min(days, 5),
      workoutStructure: "User preference: Classic Bro Split (one muscle group per day)"
    };
  }
  
  return {
    split: "Push/Pull/Legs",
    daysPerWeek: Math.min(days, 6),
    workoutStructure: "Default: Push/Pull/Legs split"
  };
}

function normalizeWorkoutType(type: string): string {
  const normalized = type.toLowerCase().replace(/[\s_-]+/g, '_');
  
  if (normalized.includes('push')) return WORKOUT_TYPES.PUSH;
  if (normalized.includes('pull')) return WORKOUT_TYPES.PULL;
  if (normalized.includes('leg')) return WORKOUT_TYPES.LEGS;
  if (normalized.includes('chest')) return WORKOUT_TYPES.CHEST;
  if (normalized.includes('back')) return WORKOUT_TYPES.BACK;
  if (normalized.includes('shoulder')) return WORKOUT_TYPES.SHOULDERS;
  if (normalized.includes('arm') || normalized.includes('bicep') || normalized.includes('tricep')) return WORKOUT_TYPES.ARMS;
  if (normalized.includes('upper')) return WORKOUT_TYPES.UPPER;
  if (normalized.includes('lower')) return WORKOUT_TYPES.LOWER;
  if (normalized.includes('full') || normalized.includes('body')) return WORKOUT_TYPES.FULL_BODY;
  if (normalized.includes('cardio') || normalized.includes('hiit')) return WORKOUT_TYPES.CARDIO;
  
  return WORKOUT_TYPES.FULL_BODY;
}
