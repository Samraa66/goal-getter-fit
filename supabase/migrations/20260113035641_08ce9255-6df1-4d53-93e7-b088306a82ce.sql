-- Add muscle_groups and how_to columns to exercises table
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS muscle_groups TEXT,
ADD COLUMN IF NOT EXISTS how_to TEXT;