-- Optional: explicit plan feedback (e.g. thumbs up/down) for improving selection over time
CREATE TABLE IF NOT EXISTS public.plan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT,
  rating SMALLINT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_feedback_user_type_created
  ON public.plan_feedback(user_id, target_type, created_at DESC);

ALTER TABLE public.plan_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan_feedback"
  ON public.plan_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plan_feedback"
  ON public.plan_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
