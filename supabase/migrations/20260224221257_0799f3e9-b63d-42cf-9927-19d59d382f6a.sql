
-- Drop legacy tables in correct order (respecting foreign key dependencies)

-- First drop tables that reference others
DROP TABLE IF EXISTS public.exercises CASCADE;
DROP TABLE IF EXISTS public.meals CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.adjustment_history CASCADE;

-- Then drop parent tables
DROP TABLE IF EXISTS public.meal_plans CASCADE;
DROP TABLE IF EXISTS public.workout_programs CASCADE;
DROP TABLE IF EXISTS public.plan_versions CASCADE;
DROP TABLE IF EXISTS public.user_constraints CASCADE;
