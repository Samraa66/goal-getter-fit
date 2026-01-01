-- Create ai_usage table for tracking per-user AI generation limits
CREATE TABLE public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  generation_count INTEGER NOT NULL DEFAULT 0,
  last_generation_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

-- Enable Row Level Security
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access their own usage data
CREATE POLICY "Users can view own usage"
ON public.ai_usage
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
ON public.ai_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
ON public.ai_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to check and increment AI usage with rate limiting
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage ai_usage%ROWTYPE;
  v_daily_limit INTEGER := 10;
  v_rate_limit_seconds INTEGER := 10;
  v_seconds_since_last NUMERIC;
BEGIN
  -- Get or create today's usage record
  SELECT * INTO v_usage 
  FROM ai_usage 
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  IF NOT FOUND THEN
    -- Create new record for today
    INSERT INTO ai_usage (user_id, usage_date, generation_count, last_generation_at)
    VALUES (p_user_id, CURRENT_DATE, 0, NULL)
    RETURNING * INTO v_usage;
  END IF;
  
  -- Check rate limit (10 seconds between requests)
  IF v_usage.last_generation_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_usage.last_generation_at));
    IF v_seconds_since_last < v_rate_limit_seconds THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'error', 'rate_limit',
        'message', 'Please wait ' || CEIL(v_rate_limit_seconds - v_seconds_since_last) || ' seconds before generating again.',
        'wait_seconds', CEIL(v_rate_limit_seconds - v_seconds_since_last)
      );
    END IF;
  END IF;
  
  -- Check daily limit
  IF v_usage.generation_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'daily_limit',
      'message', 'You''ve reached today''s AI limit (10 generations). Try again tomorrow.',
      'used', v_usage.generation_count,
      'limit', v_daily_limit
    );
  END IF;
  
  -- Increment usage and update timestamp
  UPDATE ai_usage 
  SET generation_count = generation_count + 1,
      last_generation_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_usage.generation_count + 1,
    'limit', v_daily_limit,
    'remaining', v_daily_limit - v_usage.generation_count - 1
  );
END;
$$;

-- Create trigger for updating updated_at
CREATE TRIGGER update_ai_usage_updated_at
BEFORE UPDATE ON public.ai_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();