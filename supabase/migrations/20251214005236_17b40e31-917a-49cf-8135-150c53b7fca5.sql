
-- 1. User Subscription Tiers (Backend-enforced)
CREATE TYPE public.subscription_tier AS ENUM ('free', 'paid');

CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  monthly_regenerations_used INTEGER DEFAULT 0,
  monthly_ai_messages_used INTEGER DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. User Constraint Profile (Central constraint model)
CREATE TABLE public.user_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Fitness constraints
  workouts_per_week INTEGER DEFAULT 3,
  workout_duration_minutes INTEGER DEFAULT 45,
  equipment_access TEXT[] DEFAULT ARRAY['bodyweight'],
  preferred_workout_days INTEGER[] DEFAULT ARRAY[1,3,5],
  
  -- Nutrition constraints
  weekly_food_budget NUMERIC DEFAULT 100,
  meals_per_day INTEGER DEFAULT 3,
  max_cooking_time_minutes INTEGER DEFAULT 30,
  protein_target_grams INTEGER,
  
  -- Preferences
  simplify_after_deviations INTEGER DEFAULT 3,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own constraints" ON public.user_constraints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own constraints" ON public.user_constraints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own constraints" ON public.user_constraints FOR UPDATE USING (auth.uid() = user_id);

-- 3. Plan Versions (Track constraint snapshots per plan)
CREATE TABLE public.plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('meal', 'workout')),
  version_number INTEGER NOT NULL DEFAULT 1,
  constraints_snapshot JSONB NOT NULL,
  estimated_weekly_cost NUMERIC,
  adjustment_reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan versions" ON public.plan_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plan versions" ON public.plan_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plan versions" ON public.plan_versions FOR UPDATE USING (auth.uid() = user_id);

-- 4. Deviation Events (Track all deviations)
CREATE TYPE public.deviation_type AS ENUM ('skipped_workout', 'shortened_workout', 'missed_meal', 'substituted_meal', 'dining_out', 'budget_exceeded');
CREATE TYPE public.deviation_reason AS ENUM ('time', 'budget', 'energy', 'preference', 'dining_out', 'illness', 'other');

CREATE TABLE public.deviation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deviation_type deviation_type NOT NULL,
  reason deviation_reason NOT NULL,
  related_workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  related_meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  notes TEXT,
  impact_calories INTEGER,
  impact_protein INTEGER,
  impact_budget NUMERIC,
  auto_adjusted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.deviation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deviations" ON public.deviation_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deviations" ON public.deviation_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Weekly Check-Ins
CREATE TYPE public.adherence_level AS ENUM ('yes', 'partial', 'no');

CREATE TABLE public.weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  workout_adherence adherence_level NOT NULL,
  meal_adherence adherence_level NOT NULL,
  budget_adherence adherence_level NOT NULL,
  primary_reason deviation_reason,
  notes TEXT,
  adjustment_applied BOOLEAN DEFAULT false,
  adjustment_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins" ON public.weekly_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkins" ON public.weekly_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkins" ON public.weekly_checkins FOR UPDATE USING (auth.uid() = user_id);

-- 6. Adjustment History (Track all plan adjustments)
CREATE TABLE public.adjustment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_version_id UUID REFERENCES public.plan_versions(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL,
  rule_applied TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  triggered_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.adjustment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adjustments" ON public.adjustment_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own adjustments" ON public.adjustment_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Dining Out Events (Camera page tracking)
CREATE TABLE public.dining_out_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scanned_menu_id UUID REFERENCES public.scanned_menus(id) ON DELETE SET NULL,
  replaced_meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  meal_type TEXT NOT NULL,
  estimated_calories INTEGER,
  estimated_protein INTEGER,
  estimated_cost NUMERIC,
  compensation_applied BOOLEAN DEFAULT false,
  compensation_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.dining_out_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dining events" ON public.dining_out_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dining events" ON public.dining_out_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dining events" ON public.dining_out_events FOR UPDATE USING (auth.uid() = user_id);

-- 8. Add version tracking to existing tables
ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES public.plan_versions(id);
ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS estimated_weekly_cost NUMERIC;
ALTER TABLE public.workout_programs ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES public.plan_versions(id);

-- 9. Function to check subscription limits
CREATE OR REPLACE FUNCTION public.check_subscription_limit(
  p_user_id UUID,
  p_limit_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription user_subscriptions%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_subscription FROM user_subscriptions WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_subscriptions (user_id, tier) VALUES (p_user_id, 'free')
    RETURNING * INTO v_subscription;
  END IF;
  
  -- Reset monthly counters if needed
  IF v_subscription.reset_at < now() THEN
    UPDATE user_subscriptions 
    SET monthly_regenerations_used = 0,
        monthly_ai_messages_used = 0,
        reset_at = date_trunc('month', now()) + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscription;
  END IF;
  
  CASE p_limit_type
    WHEN 'regeneration' THEN
      v_result := jsonb_build_object(
        'allowed', v_subscription.tier = 'paid' OR v_subscription.monthly_regenerations_used < 3,
        'used', v_subscription.monthly_regenerations_used,
        'limit', CASE WHEN v_subscription.tier = 'paid' THEN -1 ELSE 3 END,
        'tier', v_subscription.tier
      );
    WHEN 'ai_message' THEN
      v_result := jsonb_build_object(
        'allowed', v_subscription.tier = 'paid' OR v_subscription.monthly_ai_messages_used < 20,
        'used', v_subscription.monthly_ai_messages_used,
        'limit', CASE WHEN v_subscription.tier = 'paid' THEN -1 ELSE 20 END,
        'tier', v_subscription.tier
      );
    WHEN 'auto_adjust' THEN
      v_result := jsonb_build_object(
        'allowed', v_subscription.tier = 'paid',
        'tier', v_subscription.tier
      );
    WHEN 'community_write' THEN
      v_result := jsonb_build_object(
        'allowed', v_subscription.tier = 'paid',
        'tier', v_subscription.tier
      );
    ELSE
      v_result := jsonb_build_object('error', 'Unknown limit type');
  END CASE;
  
  RETURN v_result;
END;
$$;

-- 10. Function to increment usage counters
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_usage_type
    WHEN 'regeneration' THEN
      UPDATE user_subscriptions 
      SET monthly_regenerations_used = monthly_regenerations_used + 1
      WHERE user_id = p_user_id;
    WHEN 'ai_message' THEN
      UPDATE user_subscriptions 
      SET monthly_ai_messages_used = monthly_ai_messages_used + 1
      WHERE user_id = p_user_id;
  END CASE;
END;
$$;

-- 11. Trigger for updated_at
CREATE TRIGGER update_user_constraints_updated_at
  BEFORE UPDATE ON public.user_constraints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
