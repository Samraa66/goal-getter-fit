-- Deny anonymous access to profiles table (contains PII: email, weight, health data)
CREATE POLICY "Deny public access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to chat_messages table (private conversations)
CREATE POLICY "Deny public access to chat_messages"
ON public.chat_messages
FOR SELECT
TO anon
USING (false);