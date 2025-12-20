-- Add missing columns to profiles for full personalization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS activity_level text,
ADD COLUMN IF NOT EXISTS workouts_per_week integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS other_sports text[];