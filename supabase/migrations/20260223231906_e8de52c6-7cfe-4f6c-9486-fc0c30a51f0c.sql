
-- Add enhanced metrics to workout_templates for template-first matching
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS muscle_group_focus text,
  ADD COLUMN IF NOT EXISTS training_split text,
  ADD COLUMN IF NOT EXISTS workout_location text DEFAULT 'gym',
  ADD COLUMN IF NOT EXISTS total_sets integer,
  ADD COLUMN IF NOT EXISTS estimated_calories_burned integer,
  ADD COLUMN IF NOT EXISTS intensity_level text DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS recovery_demand text DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS sport_conflict_groups text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active_recovery boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_warmup_minutes integer DEFAULT 5;
