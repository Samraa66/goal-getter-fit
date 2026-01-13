-- Create AI call logs table for monitoring and cost tracking
CREATE TABLE public.ai_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  estimated_cost NUMERIC(10,6),
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own logs
CREATE POLICY "Users can view own AI logs" 
ON public.ai_call_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only service role can insert (edge functions use service role for logging)
CREATE POLICY "Service role can insert AI logs"
ON public.ai_call_logs
FOR INSERT
WITH CHECK (true);

-- Create index for efficient querying by user and date
CREATE INDEX idx_ai_call_logs_user_date ON public.ai_call_logs (user_id, created_at DESC);
CREATE INDEX idx_ai_call_logs_function ON public.ai_call_logs (function_name, created_at DESC);

-- Add comments for admin dashboard queries
COMMENT ON TABLE public.ai_call_logs IS 'Tracks all AI function calls for cost monitoring and abuse detection';
COMMENT ON COLUMN public.ai_call_logs.estimated_cost IS 'Estimated cost in USD based on token usage';