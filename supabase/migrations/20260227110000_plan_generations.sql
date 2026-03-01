-- Plan generations: idempotency and audit for meal/workout plan generation
CREATE TABLE IF NOT EXISTS public.plan_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL,
  scope TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  input_snapshot JSONB,
  result_summary JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_generations_user_type_created
  ON public.plan_generations(user_id, generation_type, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_generations_idempotency
  ON public.plan_generations(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.plan_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan_generations"
  ON public.plan_generations FOR SELECT USING (auth.uid() = user_id);
-- Inserts/updates from edge functions use service role (RLS bypassed). No user INSERT/UPDATE policy needed.
