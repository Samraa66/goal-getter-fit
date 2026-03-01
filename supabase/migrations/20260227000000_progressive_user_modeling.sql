-- Progressive User Modeling: user_signals, user_insights, recompute function, triggers

-- ─── Table: user_signals ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'meal_completed', 'meal_skipped', 'meal_swapped',
    'workout_completed', 'workout_skipped', 'food_scanned',
    'coach_message', 'water_logged', 'checkin_submitted'
  )),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signals_user_id ON public.user_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_created_at ON public.user_signals(created_at);

ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own signals"
  ON public.user_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own signals"
  ON public.user_signals FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Table: user_insights ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_insights (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_meal_times JSONB DEFAULT '{}',
  avoided_foods TEXT[] DEFAULT '{}',
  favorite_cuisines TEXT[] DEFAULT '{}',
  workout_consistency_score FLOAT DEFAULT 0,
  avg_calories_consumed FLOAT DEFAULT 0,
  hydration_consistency FLOAT DEFAULT 0,
  most_skipped_meal_type TEXT,
  most_completed_workout_type TEXT,
  energy_pattern TEXT CHECK (energy_pattern IN ('morning', 'evening', 'inconsistent')),
  template_affinity JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own insights"
  ON public.user_insights FOR SELECT
  USING (auth.uid() = id);

-- ─── Function: recompute_user_insights ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_user_insights(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workout_completed INT;
  v_workout_skipped INT;
  v_workout_consistency FLOAT := 0;
  v_water_days INT;
  v_hydration FLOAT := 0;
  v_avg_calories FLOAT := 0;
  v_most_skipped TEXT;
  v_most_completed TEXT;
  v_template_affinity JSONB := '{}';
BEGIN
  -- Workout consistency: completed / (completed + skipped), clamped 0-1
  SELECT COUNT(*) INTO v_workout_completed
  FROM user_signals
  WHERE user_id = p_user_id AND signal_type = 'workout_completed'
    AND created_at >= NOW() - INTERVAL '30 days';

  SELECT COUNT(*) INTO v_workout_skipped
  FROM user_signals
  WHERE user_id = p_user_id AND signal_type = 'workout_skipped'
    AND created_at >= NOW() - INTERVAL '30 days';

  IF (v_workout_completed + v_workout_skipped) > 0 THEN
    v_workout_consistency := LEAST(1.0, GREATEST(0.0, v_workout_completed::FLOAT / (v_workout_completed + v_workout_skipped)));
  END IF;

  -- Hydration: days with at least one water_logged / 30
  SELECT COUNT(DISTINCT DATE(created_at)) INTO v_water_days
  FROM user_signals
  WHERE user_id = p_user_id AND signal_type = 'water_logged'
    AND created_at >= NOW() - INTERVAL '30 days';

  v_hydration := LEAST(1.0, v_water_days::FLOAT / 30.0);

  -- Avg calories from food_scanned payloads
  SELECT COALESCE(AVG((payload->>'calories')::FLOAT), 0) INTO v_avg_calories
  FROM user_signals
  WHERE user_id = p_user_id AND signal_type = 'food_scanned'
    AND created_at >= NOW() - INTERVAL '30 days'
    AND payload->>'calories' IS NOT NULL
    AND (payload->>'calories') ~ '^\d+(\.\d+)?$';

  -- Most skipped meal type
  SELECT COALESCE(payload->>'meal_type', 'unknown') INTO v_most_skipped
  FROM (
    SELECT payload->>'meal_type' AS meal_type, COUNT(*) AS cnt
    FROM user_signals
    WHERE user_id = p_user_id AND signal_type = 'meal_skipped'
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY payload->>'meal_type'
    ORDER BY cnt DESC
    LIMIT 1
  ) sub;

  -- Most completed workout type
  SELECT COALESCE(payload->>'workout_type', 'unknown') INTO v_most_completed
  FROM (
    SELECT payload->>'workout_type' AS workout_type, COUNT(*) AS cnt
    FROM user_signals
    WHERE user_id = p_user_id AND signal_type = 'workout_completed'
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY payload->>'workout_type'
    ORDER BY cnt DESC
    LIMIT 1
  ) sub;

  -- Template affinity: for each template_id, score = (completed - skipped) / (completed + skipped), -1 to 1
  SELECT COALESCE(jsonb_object_agg(tid, score), '{}'::jsonb) INTO v_template_affinity
  FROM (
    SELECT tid,
      LEAST(1.0, GREATEST(-1.0, (completed - skipped)::FLOAT / NULLIF(completed + skipped, 0))) AS score
    FROM (
      SELECT COALESCE(payload->>'meal_template_id', payload->>'workout_template_id') AS tid,
        COUNT(*) FILTER (WHERE signal_type IN ('meal_completed', 'workout_completed')) AS completed,
        COUNT(*) FILTER (WHERE signal_type IN ('meal_skipped', 'workout_skipped')) AS skipped
      FROM user_signals
      WHERE user_id = p_user_id
        AND signal_type IN ('meal_completed', 'meal_skipped', 'workout_completed', 'workout_skipped')
        AND created_at >= NOW() - INTERVAL '30 days'
        AND COALESCE(payload->>'meal_template_id', payload->>'workout_template_id') IS NOT NULL
        AND COALESCE(payload->>'meal_template_id', payload->>'workout_template_id') != ''
      GROUP BY COALESCE(payload->>'meal_template_id', payload->>'workout_template_id')
    ) sub
    WHERE (completed + skipped) > 0
  ) sub2;

  -- Upsert user_insights
  INSERT INTO public.user_insights (
    id, workout_consistency_score, hydration_consistency, avg_calories_consumed,
    most_skipped_meal_type, most_completed_workout_type, template_affinity, last_updated
  ) VALUES (
    p_user_id, v_workout_consistency, v_hydration, v_avg_calories,
    v_most_skipped, v_most_completed, v_template_affinity, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    workout_consistency_score = EXCLUDED.workout_consistency_score,
    hydration_consistency = EXCLUDED.hydration_consistency,
    avg_calories_consumed = EXCLUDED.avg_calories_consumed,
    most_skipped_meal_type = EXCLUDED.most_skipped_meal_type,
    most_completed_workout_type = EXCLUDED.most_completed_workout_type,
    template_affinity = EXCLUDED.template_affinity,
    last_updated = NOW();
END;
$$;

-- ─── Trigger: after insert on user_signals ────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_recompute_insights()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recompute_user_insights(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_signals_insert ON public.user_signals;
CREATE TRIGGER on_user_signals_insert
  AFTER INSERT ON public.user_signals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_insights();

-- Backfill user_insights for existing profiles
INSERT INTO public.user_insights (id)
SELECT id FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- ─── Extend handle_new_user to insert user_insights ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );

  -- Optional: create user_insights row (ignore errors so signup never fails)
  BEGIN
    INSERT INTO public.user_insights (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;
