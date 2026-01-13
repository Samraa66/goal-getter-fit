-- Fix overly permissive RLS policy - restrict insert to authenticated users only
-- Note: Edge functions use service role which bypasses RLS, but this adds defense-in-depth
DROP POLICY IF EXISTS "Service role can insert AI logs" ON public.ai_call_logs;

-- Create stricter policy - only the user can insert their own logs
CREATE POLICY "Users can insert own AI logs"
ON public.ai_call_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Also prevent any updates or deletes (logs should be immutable)
-- No UPDATE or DELETE policies means these operations are blocked by RLS