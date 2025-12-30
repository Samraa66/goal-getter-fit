-- Add missing UPDATE policy for user_subscriptions
CREATE POLICY "Users can update own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Add missing DELETE policy for user_subscriptions
CREATE POLICY "Users can delete own subscription"
ON public.user_subscriptions
FOR DELETE
USING (auth.uid() = user_id);