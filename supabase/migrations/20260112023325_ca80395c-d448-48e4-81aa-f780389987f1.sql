-- Create chat_sessions table for organizing conversations
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text DEFAULT 'New Chat',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_at timestamp with time zone DEFAULT now(),
  message_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" 
ON public.chat_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" 
ON public.chat_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" 
ON public.chat_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add session_id to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_last_message_at ON public.chat_sessions(last_message_at DESC);

-- Create trigger to update session stats when messages are added
CREATE OR REPLACE FUNCTION public.update_chat_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE public.chat_sessions
    SET 
      last_message_at = now(),
      updated_at = now(),
      message_count = message_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER on_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_session_stats();