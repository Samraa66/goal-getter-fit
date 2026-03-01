-- meal_templates is referenced by 20260216041437 (user_meals) but was never created in repo.
-- This migration runs just before that one so local Supabase (e.g. supabase start) has the table.
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

ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read meal templates" ON public.meal_templates;
CREATE POLICY "Anyone can read meal templates" ON public.meal_templates FOR SELECT USING (true);
