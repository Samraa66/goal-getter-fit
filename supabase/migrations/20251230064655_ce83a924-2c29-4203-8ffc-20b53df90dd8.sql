-- Expand allowed workout_type values to support split-based programs (push/pull/legs/etc.)
ALTER TABLE public.workouts
DROP CONSTRAINT IF EXISTS workouts_workout_type_check;

ALTER TABLE public.workouts
ADD CONSTRAINT workouts_workout_type_check
CHECK (
  workout_type = ANY (
    ARRAY[
      'strength'::text,
      'cardio'::text,
      'flexibility'::text,
      'rest'::text,
      'push'::text,
      'pull'::text,
      'legs'::text,
      'chest'::text,
      'back'::text,
      'shoulders'::text,
      'arms'::text,
      'upper'::text,
      'lower'::text,
      'upper_body'::text,
      'lower_body'::text,
      'full_body'::text
    ]
  )
);