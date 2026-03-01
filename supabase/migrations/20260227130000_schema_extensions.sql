-- Optional columns for templates and user_insights (reliability, analytics)
-- All ADD COLUMN IF NOT EXISTS for safe deployment

-- meal_templates: versioning, bounds, soft disable
ALTER TABLE public.meal_templates
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_calories integer,
  ADD COLUMN IF NOT EXISTS max_calories integer;

-- workout_templates: versioning, soft disable
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- user_insights: when we last generated (for smarter defaults)
ALTER TABLE public.user_insights
  ADD COLUMN IF NOT EXISTS last_meal_plan_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_workout_plan_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_meal_slots jsonb DEFAULT '{}';
