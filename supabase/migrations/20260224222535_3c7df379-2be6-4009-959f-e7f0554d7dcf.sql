
-- ============================================
-- 1. supplement_templates (global, like workout_templates / meal_templates)
-- ============================================
CREATE TABLE public.supplement_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  type TEXT NOT NULL, -- protein, vitamin, pre-workout, recovery, creatine, etc.
  serving_size NUMERIC,
  unit TEXT, -- grams, ml, capsules, scoops
  per_serving_calories INTEGER DEFAULT 0,
  per_serving_protein NUMERIC DEFAULT 0,
  per_serving_carbs NUMERIC DEFAULT 0,
  per_serving_fats NUMERIC DEFAULT 0,
  description TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.supplement_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read supplement templates"
  ON public.supplement_templates FOR SELECT
  USING (true);

-- ============================================
-- 2. daily_plans (user-scoped)
-- ============================================
CREATE TABLE public.daily_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT,
  description TEXT,
  day_number INTEGER NOT NULL DEFAULT 1,
  date_assigned DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_plans"
  ON public.daily_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_plans"
  ON public.daily_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_plans"
  ON public.daily_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_plans"
  ON public.daily_plans FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. daily_plan_workouts (join table)
-- ============================================
CREATE TABLE public.daily_plan_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_plan_id UUID NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  workout_template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  scheduled_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_plan_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_plan_workouts"
  ON public.daily_plan_workouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can insert own daily_plan_workouts"
  ON public.daily_plan_workouts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can update own daily_plan_workouts"
  ON public.daily_plan_workouts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can delete own daily_plan_workouts"
  ON public.daily_plan_workouts FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));

-- ============================================
-- 4. daily_plan_meals (join table)
-- ============================================
CREATE TABLE public.daily_plan_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_plan_id UUID NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  meal_template_id UUID NOT NULL REFERENCES public.meal_templates(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
  sort_order INTEGER DEFAULT 0,
  scheduled_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_plan_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_plan_meals"
  ON public.daily_plan_meals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can insert own daily_plan_meals"
  ON public.daily_plan_meals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can update own daily_plan_meals"
  ON public.daily_plan_meals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can delete own daily_plan_meals"
  ON public.daily_plan_meals FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));

-- ============================================
-- 5. daily_plan_supplements (join table)
-- ============================================
CREATE TABLE public.daily_plan_supplements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_plan_id UUID NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  supplement_template_id UUID NOT NULL REFERENCES public.supplement_templates(id) ON DELETE CASCADE,
  timing TEXT NOT NULL DEFAULT 'morning', -- pre-workout, post-workout, with-meal, morning, evening, before-bed
  dosage NUMERIC,
  unit TEXT, -- grams, ml, capsules, scoops
  sort_order INTEGER DEFAULT 0,
  scheduled_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_plan_supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_plan_supplements"
  ON public.daily_plan_supplements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can insert own daily_plan_supplements"
  ON public.daily_plan_supplements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can update own daily_plan_supplements"
  ON public.daily_plan_supplements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can delete own daily_plan_supplements"
  ON public.daily_plan_supplements FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.daily_plans dp WHERE dp.id = daily_plan_id AND dp.user_id = auth.uid()));

-- ============================================
-- 6. user_supplement_logs (user-scoped intake tracking)
-- ============================================
CREATE TABLE public.user_supplement_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplement_template_id UUID REFERENCES public.supplement_templates(id) ON DELETE SET NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dosage NUMERIC,
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_supplement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement_logs"
  ON public.user_supplement_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own supplement_logs"
  ON public.user_supplement_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own supplement_logs"
  ON public.user_supplement_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own supplement_logs"
  ON public.user_supplement_logs FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_supplement_templates_type ON public.supplement_templates(type);
CREATE INDEX idx_daily_plans_user_id ON public.daily_plans(user_id);
CREATE INDEX idx_daily_plans_date ON public.daily_plans(user_id, date_assigned);
CREATE INDEX idx_daily_plan_workouts_plan ON public.daily_plan_workouts(daily_plan_id);
CREATE INDEX idx_daily_plan_meals_plan ON public.daily_plan_meals(daily_plan_id);
CREATE INDEX idx_daily_plan_supplements_plan ON public.daily_plan_supplements(daily_plan_id);
CREATE INDEX idx_user_supplement_logs_user ON public.user_supplement_logs(user_id);
CREATE INDEX idx_user_supplement_logs_taken ON public.user_supplement_logs(user_id, taken_at);

-- ============================================
-- updated_at trigger for new tables
-- ============================================
CREATE TRIGGER update_supplement_templates_updated_at
  BEFORE UPDATE ON public.supplement_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
