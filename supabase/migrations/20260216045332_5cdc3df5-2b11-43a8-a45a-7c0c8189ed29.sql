
-- 1. Add serving tracking columns to user_meals
ALTER TABLE public.user_meals
ADD COLUMN IF NOT EXISTS remaining_servings integer,
ADD COLUMN IF NOT EXISTS total_servings integer;

-- 2. Create user_daily_meals table for daily slot scheduling
CREATE TABLE IF NOT EXISTS public.user_daily_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  meal_slot text NOT NULL, -- breakfast/lunch/dinner/snack
  user_meal_id uuid REFERENCES public.user_meals(id) ON DELETE CASCADE,
  servings_used integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_daily_meals ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_daily_meals
CREATE POLICY "Users can view own daily meals"
ON public.user_daily_meals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily meals"
ON public.user_daily_meals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily meals"
ON public.user_daily_meals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily meals"
ON public.user_daily_meals FOR DELETE
USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_daily_meals_user_date ON public.user_daily_meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_daily_meals_user_meal ON public.user_daily_meals(user_meal_id);
