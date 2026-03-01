
-- ============================================
-- 1. WORKOUT TEMPLATES (global, read-only)
-- ============================================
CREATE TABLE public.workout_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  goal_type TEXT,
  difficulty TEXT,
  duration_minutes INTEGER,
  equipment_type TEXT,
  tags TEXT[],
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Public read access (templates are global)
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read workout templates"
  ON public.workout_templates FOR SELECT
  USING (true);

-- ============================================
-- 2. USER_MEALS (personalized copies)
-- ============================================
CREATE TABLE public.user_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  base_template_id UUID REFERENCES public.meal_templates(id),
  personalized_data JSONB NOT NULL,
  date_assigned DATE NOT NULL,
  meal_type TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  total_calories INTEGER,
  total_protein NUMERIC,
  total_carbs NUMERIC,
  total_fats NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_meals"
  ON public.user_meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_meals"
  ON public.user_meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_meals"
  ON public.user_meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_meals"
  ON public.user_meals FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. USER_WORKOUTS (personalized copies)
-- ============================================
CREATE TABLE public.user_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  base_template_id UUID REFERENCES public.workout_templates(id),
  personalized_data JSONB NOT NULL,
  date_assigned DATE NOT NULL,
  day_of_week INTEGER,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_workouts"
  ON public.user_workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_workouts"
  ON public.user_workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_workouts"
  ON public.user_workouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_workouts"
  ON public.user_workouts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. Make meal_templates publicly readable
-- ============================================
DROP POLICY IF EXISTS "Anyone can read meal templates" ON public.meal_templates;
CREATE POLICY "Anyone can read meal templates"
  ON public.meal_templates FOR SELECT
  USING (true);

-- ============================================
-- 5. Add difficulty column to meal_templates if useful for filtering
-- ============================================
ALTER TABLE public.meal_templates ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE public.meal_templates ADD COLUMN IF NOT EXISTS equipment_type TEXT;
