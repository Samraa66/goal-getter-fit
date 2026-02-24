
-- 1. Add cooking_style_preference and meals_per_day to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cooking_style_preference text DEFAULT 'cook_daily',
  ADD COLUMN IF NOT EXISTS meals_per_day integer DEFAULT 3;

-- 2. Add batch-cooking fields to meal_templates
ALTER TABLE public.meal_templates
  ADD COLUMN IF NOT EXISTS batch_friendly boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_servings integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recommended_storage_days integer DEFAULT 1;

-- 3. Add batch-cooking fields to user_meals
ALTER TABLE public.user_meals
  ADD COLUMN IF NOT EXISTS preparation_type text DEFAULT 'single_day',
  ADD COLUMN IF NOT EXISTS is_batch_meal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS days_covered integer DEFAULT 1;
