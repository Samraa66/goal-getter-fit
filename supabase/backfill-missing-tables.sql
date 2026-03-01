-- =============================================================================
-- Backfill: create tables that would have been created by migration 1 and
-- meal_templates (referenced by later migrations but never created in repo).
-- Run this ONCE in Supabase Dashboard → SQL Editor, then run the repair script
-- and db push so the rest of the schema (user_meals, user_workouts, etc.) applies.
-- =============================================================================

-- Helper: update_updated_at (migration 2 replaces this; idempotent here)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for profiles (only if trigger doesn't exist)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- Tables from first migration (skip profiles; it already exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  total_calories INTEGER,
  total_protein INTEGER,
  total_carbs INTEGER,
  total_fats INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

CREATE TABLE IF NOT EXISTS public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fats INTEGER,
  recipe TEXT,
  image_url TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  week_number INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6) NOT NULL,
  workout_type TEXT CHECK (workout_type IN ('strength', 'cardio', 'flexibility', 'rest')) NOT NULL,
  name TEXT NOT NULL,
  duration_minutes INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  weight TEXT,
  duration_seconds INTEGER,
  rest_seconds INTEGER DEFAULT 60,
  notes TEXT,
  video_url TEXT,
  order_index INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight DECIMAL(5,2),
  calories_consumed INTEGER,
  calories_burned INTEGER,
  water_glasses INTEGER,
  sleep_hours DECIMAL(3,1),
  mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.scanned_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_name TEXT,
  image_url TEXT,
  analysis_result JSONB,
  selected_meal TEXT,
  calories_estimate INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- meal_templates (referenced by 20260216041437 but never created in migrations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.meal_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  goal_type TEXT,
  meal_type TEXT,
  servings INTEGER,
  per_serving_calories INTEGER,
  per_serving_protein NUMERIC,
  per_serving_carbs NUMERIC,
  per_serving_fats NUMERIC,
  tags TEXT[],
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  difficulty TEXT,
  equipment_type TEXT,
  batch_friendly BOOLEAN DEFAULT false,
  default_servings INTEGER DEFAULT 1,
  recommended_storage_days INTEGER DEFAULT 1,
  total_calories INTEGER,
  total_protein NUMERIC,
  total_carbs NUMERIC,
  total_fats NUMERIC
);

-- =============================================================================
-- RLS and policies for tables we just created (idempotent: drop then create)
-- =============================================================================

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

-- meal_plans
DROP POLICY IF EXISTS "Users can view own meal plans" ON public.meal_plans;
CREATE POLICY "Users can view own meal plans" ON public.meal_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own meal plans" ON public.meal_plans;
CREATE POLICY "Users can insert own meal plans" ON public.meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own meal plans" ON public.meal_plans;
CREATE POLICY "Users can update own meal plans" ON public.meal_plans FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own meal plans" ON public.meal_plans;
CREATE POLICY "Users can delete own meal plans" ON public.meal_plans FOR DELETE USING (auth.uid() = user_id);

-- meals
DROP POLICY IF EXISTS "Users can view own meals" ON public.meals;
CREATE POLICY "Users can view own meals" ON public.meals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own meals" ON public.meals;
CREATE POLICY "Users can insert own meals" ON public.meals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own meals" ON public.meals;
CREATE POLICY "Users can update own meals" ON public.meals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own meals" ON public.meals;
CREATE POLICY "Users can delete own meals" ON public.meals FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));

-- workout_programs
DROP POLICY IF EXISTS "Users can view own programs" ON public.workout_programs;
CREATE POLICY "Users can view own programs" ON public.workout_programs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own programs" ON public.workout_programs;
CREATE POLICY "Users can insert own programs" ON public.workout_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own programs" ON public.workout_programs;
CREATE POLICY "Users can update own programs" ON public.workout_programs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own programs" ON public.workout_programs;
CREATE POLICY "Users can delete own programs" ON public.workout_programs FOR DELETE USING (auth.uid() = user_id);

-- workouts
DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;
CREATE POLICY "Users can update own workouts" ON public.workouts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));

-- exercises
DROP POLICY IF EXISTS "Users can view own exercises" ON public.exercises;
CREATE POLICY "Users can view own exercises" ON public.exercises FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workouts w
    JOIN public.workout_programs wp ON wp.id = w.program_id
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Users can insert own exercises" ON public.exercises;
CREATE POLICY "Users can insert own exercises" ON public.exercises FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workouts w
    JOIN public.workout_programs wp ON wp.id = w.program_id
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Users can update own exercises" ON public.exercises;
CREATE POLICY "Users can update own exercises" ON public.exercises FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.workouts w
    JOIN public.workout_programs wp ON wp.id = w.program_id
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.exercises;
CREATE POLICY "Users can delete own exercises" ON public.exercises FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.workouts w
    JOIN public.workout_programs wp ON wp.id = w.program_id
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));

-- progress_logs
DROP POLICY IF EXISTS "Users can view own progress" ON public.progress_logs;
CREATE POLICY "Users can view own progress" ON public.progress_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own progress" ON public.progress_logs;
CREATE POLICY "Users can insert own progress" ON public.progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own progress" ON public.progress_logs;
CREATE POLICY "Users can update own progress" ON public.progress_logs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own progress" ON public.progress_logs;
CREATE POLICY "Users can delete own progress" ON public.progress_logs FOR DELETE USING (auth.uid() = user_id);

-- scanned_menus
DROP POLICY IF EXISTS "Users can view own scans" ON public.scanned_menus;
CREATE POLICY "Users can view own scans" ON public.scanned_menus FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own scans" ON public.scanned_menus;
CREATE POLICY "Users can insert own scans" ON public.scanned_menus FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own scans" ON public.scanned_menus;
CREATE POLICY "Users can delete own scans" ON public.scanned_menus FOR DELETE USING (auth.uid() = user_id);

-- chat_messages
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- meal_templates (public read)
DROP POLICY IF EXISTS "Anyone can read meal templates" ON public.meal_templates;
CREATE POLICY "Anyone can read meal templates" ON public.meal_templates FOR SELECT USING (true);
