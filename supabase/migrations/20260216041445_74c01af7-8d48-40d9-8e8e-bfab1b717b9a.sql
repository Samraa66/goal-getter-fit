
-- Fix: meal_templates already had no RLS enabled
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
