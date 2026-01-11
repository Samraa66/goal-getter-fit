-- ============================================
-- CRITICAL SECURITY FIX: Lock down all sensitive tables
-- ============================================

-- 1. PROFILES TABLE - Contains PII (email, name, health data)
-- Drop existing policies and recreate with proper restrictions
DROP POLICY IF EXISTS "Deny public access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (prevents bypassing)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Create strict policies - users can ONLY access their own data
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2. CHAT_MESSAGES TABLE - Contains private conversations
DROP POLICY IF EXISTS "Deny public access to chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" 
  ON public.chat_messages FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" 
  ON public.chat_messages FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages" 
  ON public.chat_messages FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" 
  ON public.chat_messages FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. USER_SUBSCRIPTIONS TABLE - Contains subscription/payment info
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.user_subscriptions;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" 
  ON public.user_subscriptions FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" 
  ON public.user_subscriptions FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" 
  ON public.user_subscriptions FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscription" 
  ON public.user_subscriptions FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. PROGRESS_LOGS TABLE - Contains health metrics
DROP POLICY IF EXISTS "Users can view own progress" ON public.progress_logs;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.progress_logs;
DROP POLICY IF EXISTS "Users can update own progress" ON public.progress_logs;
DROP POLICY IF EXISTS "Users can delete own progress" ON public.progress_logs;

ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" 
  ON public.progress_logs FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" 
  ON public.progress_logs FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" 
  ON public.progress_logs FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress" 
  ON public.progress_logs FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. SCANNED_MENUS TABLE - Contains location/dining data
DROP POLICY IF EXISTS "Users can view own scans" ON public.scanned_menus;
DROP POLICY IF EXISTS "Users can insert own scans" ON public.scanned_menus;
DROP POLICY IF EXISTS "Users can delete own scans" ON public.scanned_menus;

ALTER TABLE public.scanned_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_menus FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans" 
  ON public.scanned_menus FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans" 
  ON public.scanned_menus FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans" 
  ON public.scanned_menus FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans" 
  ON public.scanned_menus FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. AI_USAGE TABLE - Add missing DELETE policy
DROP POLICY IF EXISTS "Users can view own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON public.ai_usage;

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" 
  ON public.ai_usage FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" 
  ON public.ai_usage FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" 
  ON public.ai_usage FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own usage" 
  ON public.ai_usage FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. USER_CONSTRAINTS TABLE - Add missing DELETE policy
DROP POLICY IF EXISTS "Users can view own constraints" ON public.user_constraints;
DROP POLICY IF EXISTS "Users can insert own constraints" ON public.user_constraints;
DROP POLICY IF EXISTS "Users can update own constraints" ON public.user_constraints;

ALTER TABLE public.user_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_constraints FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own constraints" 
  ON public.user_constraints FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own constraints" 
  ON public.user_constraints FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own constraints" 
  ON public.user_constraints FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own constraints" 
  ON public.user_constraints FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. PLAN_VERSIONS TABLE - Add missing DELETE policy
DROP POLICY IF EXISTS "Users can view own plan versions" ON public.plan_versions;
DROP POLICY IF EXISTS "Users can insert own plan versions" ON public.plan_versions;
DROP POLICY IF EXISTS "Users can update own plan versions" ON public.plan_versions;

ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan versions" 
  ON public.plan_versions FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan versions" 
  ON public.plan_versions FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan versions" 
  ON public.plan_versions FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan versions" 
  ON public.plan_versions FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 9. DEVIATION_EVENTS TABLE - Add missing UPDATE and DELETE policies
DROP POLICY IF EXISTS "Users can view own deviations" ON public.deviation_events;
DROP POLICY IF EXISTS "Users can insert own deviations" ON public.deviation_events;

ALTER TABLE public.deviation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deviation_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deviations" 
  ON public.deviation_events FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deviations" 
  ON public.deviation_events FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deviations" 
  ON public.deviation_events FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deviations" 
  ON public.deviation_events FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 10. ADJUSTMENT_HISTORY TABLE - Add missing UPDATE and DELETE policies
DROP POLICY IF EXISTS "Users can view own adjustments" ON public.adjustment_history;
DROP POLICY IF EXISTS "Users can insert own adjustments" ON public.adjustment_history;

ALTER TABLE public.adjustment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_history FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adjustments" 
  ON public.adjustment_history FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adjustments" 
  ON public.adjustment_history FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adjustments" 
  ON public.adjustment_history FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own adjustments" 
  ON public.adjustment_history FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 11. WEEKLY_CHECKINS TABLE - Add missing DELETE policy
DROP POLICY IF EXISTS "Users can view own checkins" ON public.weekly_checkins;
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.weekly_checkins;
DROP POLICY IF EXISTS "Users can update own checkins" ON public.weekly_checkins;

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkins FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins" 
  ON public.weekly_checkins FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins" 
  ON public.weekly_checkins FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins" 
  ON public.weekly_checkins FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own checkins" 
  ON public.weekly_checkins FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 12. DINING_OUT_EVENTS TABLE - Add missing DELETE policy
DROP POLICY IF EXISTS "Users can view own dining events" ON public.dining_out_events;
DROP POLICY IF EXISTS "Users can insert own dining events" ON public.dining_out_events;
DROP POLICY IF EXISTS "Users can update own dining events" ON public.dining_out_events;

ALTER TABLE public.dining_out_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_out_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dining events" 
  ON public.dining_out_events FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dining events" 
  ON public.dining_out_events FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dining events" 
  ON public.dining_out_events FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dining events" 
  ON public.dining_out_events FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 13. Force RLS on remaining tables that may not have it forced
ALTER TABLE public.workouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans FORCE ROW LEVEL SECURITY;