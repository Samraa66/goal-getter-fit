-- Add daily food budget column (in user's currency, per day)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_food_budget numeric DEFAULT NULL;