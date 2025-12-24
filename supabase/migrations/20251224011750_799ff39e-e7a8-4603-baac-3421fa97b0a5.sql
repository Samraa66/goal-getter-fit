-- Add preferred_split and gender columns to profiles for workout personalization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_split text,
ADD COLUMN IF NOT EXISTS gender text;