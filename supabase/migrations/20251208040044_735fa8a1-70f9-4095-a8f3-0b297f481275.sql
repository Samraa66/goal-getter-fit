-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_goal TEXT CHECK (fitness_goal IN ('lose_weight', 'gain_muscle', 'maintain', 'improve_fitness')),
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  workout_location TEXT CHECK (workout_location IN ('gym', 'home', 'both')),
  dietary_preference TEXT CHECK (dietary_preference IN ('none', 'vegetarian', 'vegan', 'keto', 'paleo')),
  allergies TEXT[],
  disliked_foods TEXT[],
  daily_calorie_target INTEGER DEFAULT 2000,
  weight_current DECIMAL(5,2),
  weight_goal DECIMAL(5,2),
  height_cm INTEGER,
  age INTEGER,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create meal_plans table
CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_date DATE NOT NULL,
  total_calories INTEGER,
  total_protein INTEGER,
  total_carbs INTEGER,
  total_fats INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

-- Create meals table
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID REFERENCES public.meal_plans(id) ON DELETE CASCADE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fats INTEGER,
  recipe TEXT,
  image_url TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workout_programs table
CREATE TABLE public.workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  week_number INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workouts table
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.workout_programs(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6) NOT NULL,
  workout_type TEXT CHECK (workout_type IN ('strength', 'cardio', 'flexibility', 'rest')) NOT NULL,
  name TEXT NOT NULL,
  duration_minutes INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create exercises table
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  weight TEXT,
  duration_seconds INTEGER,
  rest_seconds INTEGER DEFAULT 60,
  notes TEXT,
  video_url TEXT,
  order_index INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create progress_logs table
CREATE TABLE public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL,
  weight DECIMAL(5,2),
  calories_consumed INTEGER,
  calories_burned INTEGER,
  water_glasses INTEGER,
  sleep_hours DECIMAL(3,1),
  mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- Create scanned_menus table
CREATE TABLE public.scanned_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  restaurant_name TEXT,
  image_url TEXT,
  analysis_result JSONB,
  selected_meal TEXT,
  calories_estimate INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table for AI Coach history
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for meal_plans
CREATE POLICY "Users can view own meal plans" ON public.meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON public.meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON public.meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON public.meal_plans FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meals
CREATE POLICY "Users can view own meals" ON public.meals FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can insert own meals" ON public.meals FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can update own meals" ON public.meals FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can delete own meals" ON public.meals FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.meal_plans WHERE meal_plans.id = meals.meal_plan_id AND meal_plans.user_id = auth.uid()));

-- RLS Policies for workout_programs
CREATE POLICY "Users can view own programs" ON public.workout_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own programs" ON public.workout_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own programs" ON public.workout_programs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own programs" ON public.workout_programs FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for workouts
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));
CREATE POLICY "Users can update own workouts" ON public.workouts FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.workout_programs WHERE workout_programs.id = workouts.program_id AND workout_programs.user_id = auth.uid()));

-- RLS Policies for exercises
CREATE POLICY "Users can view own exercises" ON public.exercises FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.workouts w 
    JOIN public.workout_programs wp ON wp.id = w.program_id 
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own exercises" ON public.exercises FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workouts w 
    JOIN public.workout_programs wp ON wp.id = w.program_id 
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own exercises" ON public.exercises FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.workouts w 
    JOIN public.workout_programs wp ON wp.id = w.program_id 
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own exercises" ON public.exercises FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.workouts w 
    JOIN public.workout_programs wp ON wp.id = w.program_id 
    WHERE w.id = exercises.workout_id AND wp.user_id = auth.uid()
  ));

-- RLS Policies for progress_logs
CREATE POLICY "Users can view own progress" ON public.progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.progress_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.progress_logs FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for scanned_menus
CREATE POLICY "Users can view own scans" ON public.scanned_menus FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scans" ON public.scanned_menus FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scans" ON public.scanned_menus FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();