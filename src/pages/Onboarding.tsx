import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { 
  Target, 
  Utensils, 
  Dumbbell, 
  Scale, 
  Loader2, 
  Heart, 
  Zap, 
  Moon,
  Clock,
  Home,
  Building2,
  Shuffle,
  Apple,
  Leaf,
  Flame,
  Beef,
  UserCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Goal = "lose_weight" | "gain_muscle" | "maintain" | "improve_fitness";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type WorkoutLocation = "gym" | "home" | "both";
type DietPreference = "none" | "vegetarian" | "vegan" | "keto" | "paleo";
type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active";
type Gender = "male" | "female" | "non_binary";
type CookingStyle = "cook_daily" | "batch_cook_weekly";

interface OnboardingData {
  goal: Goal | null;
  gender: Gender | null;
  experienceLevel: ExperienceLevel | null;
  workoutLocation: WorkoutLocation | null;
  dietPreference: DietPreference | null;
  activityLevel: ActivityLevel | null;
  otherSports: string[];
  allergies: string[];
  dislikedFoods: string[];
  weight: string;
  targetWeight: string;
  height: string;
  age: string;
  workoutsPerWeek: number;
  dailyCalorieTarget: number;
  dailyFoodBudget: string;
  cookingStyle: CookingStyle | null;
  mealsPerDay: number;
}

const goals = [
  { id: "lose_weight" as Goal, icon: Scale, label: "Lose Weight", description: "Burn fat & get lean", color: "text-orange-500" },
  { id: "gain_muscle" as Goal, icon: Dumbbell, label: "Build Muscle", description: "Gain strength & size", color: "text-blue-500" },
  { id: "maintain" as Goal, icon: Target, label: "Maintain", description: "Keep current physique", color: "text-green-500" },
  { id: "improve_fitness" as Goal, icon: Heart, label: "Get Healthier", description: "Improve overall wellness", color: "text-pink-500" },
];

const genderOptions = [
  { id: "male" as Gender, label: "Male", icon: "👨" },
  { id: "female" as Gender, label: "Female", icon: "👩" },
  { id: "non_binary" as Gender, label: "Non-binary / Prefer not to say", icon: "🧑" },
];

const experienceLevels = [
  { id: "beginner" as ExperienceLevel, label: "Just Starting", description: "New to working out", icon: "🌱" },
  { id: "intermediate" as ExperienceLevel, label: "Some Experience", description: "6+ months of training", icon: "💪" },
  { id: "advanced" as ExperienceLevel, label: "Experienced", description: "2+ years consistent", icon: "🔥" },
];

const workoutLocations = [
  { id: "gym" as WorkoutLocation, label: "Gym", description: "Full equipment", icon: Building2 },
  { id: "home" as WorkoutLocation, label: "Home", description: "Minimal equipment", icon: Home },
  { id: "both" as WorkoutLocation, label: "Mix", description: "Flexible", icon: Shuffle },
];

const activityLevels = [
  { id: "sedentary" as ActivityLevel, label: "Sedentary", description: "Desk job, minimal movement", icon: Moon },
  { id: "lightly_active" as ActivityLevel, label: "Lightly Active", description: "Some walking daily", icon: Clock },
  { id: "moderately_active" as ActivityLevel, label: "Moderately Active", description: "Active job or hobbies", icon: Zap },
  { id: "very_active" as ActivityLevel, label: "Very Active", description: "Physical job or athlete", icon: Flame },
];

const dietPreferences = [
  { id: "none" as DietPreference, label: "No Restrictions", icon: Utensils },
  { id: "vegetarian" as DietPreference, label: "Vegetarian", icon: Apple },
  { id: "vegan" as DietPreference, label: "Vegan", icon: Leaf },
  { id: "keto" as DietPreference, label: "Keto", icon: Beef },
  { id: "paleo" as DietPreference, label: "Paleo", icon: Flame },
];

const sportsActivities = [
  { id: "running", label: "Running", icon: "🏃" },
  { id: "cycling", label: "Cycling", icon: "🚴" },
  { id: "swimming", label: "Swimming", icon: "🏊" },
  { id: "football", label: "Football", icon: "⚽" },
  { id: "basketball", label: "Basketball", icon: "🏀" },
  { id: "tennis", label: "Tennis/Padel", icon: "🎾" },
  { id: "martial_arts", label: "Martial Arts", icon: "🥋" },
  { id: "yoga", label: "Yoga/Pilates", icon: "🧘" },
  { id: "hiking", label: "Hiking", icon: "🥾" },
  { id: "dancing", label: "Dancing", icon: "💃" },
];

const commonAllergies = ["Dairy", "Gluten", "Nuts", "Shellfish", "Eggs", "Soy"];
const commonDislikedFoods = ["Broccoli", "Spinach", "Mushrooms", "Tofu", "Fish", "Liver"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingPending, setIsApplyingPending] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    goal: null,
    gender: null,
    experienceLevel: null,
    workoutLocation: null,
    dietPreference: null,
    activityLevel: null,
    otherSports: [],
    allergies: [],
    dislikedFoods: [],
    weight: "",
    targetWeight: "",
    height: "",
    age: "",
    workoutsPerWeek: 3,
    dailyCalorieTarget: 2000,
    dailyFoodBudget: "",
    cookingStyle: null,
    mealsPerDay: 3,
  });

  // Check for pending onboarding data from pre-signup flow OR redirect if already onboarded
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const pendingData = localStorage.getItem("pendingOnboarding");
      
      if (user) {
        // Check if user already completed onboarding
        const { data: profileData } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();
        
        if (profileData?.onboarding_completed && !pendingData) {
          // Already onboarded, redirect to home
          navigate("/");
          return;
        }
        
        // Apply pending onboarding data if exists
        if (pendingData) {
          setIsApplyingPending(true);
          try {
            const parsed = JSON.parse(pendingData);
            
            const pendingProfileData = {
              id: user.id,
              gender: parsed.gender,
              fitness_goal: parsed.goal,
              experience_level: parsed.experienceLevel,
              workout_location: parsed.workoutLocation,
              dietary_preference: parsed.dietPreference,
              activity_level: parsed.activityLevel,
              other_sports: parsed.otherSports || [],
              allergies: parsed.allergies || [],
              disliked_foods: parsed.dislikedFoods || [],
              weight_current: parsed.weight ? parseFloat(parsed.weight) : null,
              weight_goal: parsed.targetWeight ? parseFloat(parsed.targetWeight) : null,
              height_cm: parsed.height ? parseInt(parsed.height) : null,
              age: parsed.age ? parseInt(parsed.age) : null,
              workouts_per_week: parsed.workoutsPerWeek || 3,
              daily_calorie_target: parsed.dailyCalorieTarget || 2000,
              daily_food_budget: parsed.dailyFoodBudget ? parseFloat(parsed.dailyFoodBudget) : null,
              cooking_style_preference: parsed.cookingStyle || 'cook_daily',
              meals_per_day: parsed.mealsPerDay || 3,
              onboarding_completed: true,
            };

            // Use upsert to handle both new profiles and existing ones
            const { error } = await supabase
              .from("profiles")
              .upsert(pendingProfileData, { onConflict: "id" });

            if (error) throw error;
            
            localStorage.removeItem("pendingOnboarding");
            toast({
              title: "You're all set! 🎉",
              description: "Your personalized plan is ready.",
            });
            navigate("/");
          } catch (error) {
            console.error("Error applying pending onboarding:", error);
            localStorage.removeItem("pendingOnboarding");
            toast({
              title: "Let's set up your profile",
              description: "Please complete the setup.",
            });
          } finally {
            setIsApplyingPending(false);
          }
        }
      }
    };

    checkOnboardingStatus();
  }, [user, navigate, toast]);

  const totalSteps = 7; // Added cooking style step

  // Show loading while applying pending data
  if (isApplyingPending) {
    return (
      <div className="dark min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Setting up your personalized plan...</p>
      </div>
    );
  }

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const saveOnboardingToProfile = async (userId: string) => {
    const profileData = {
      id: userId,
      gender: data.gender,
      fitness_goal: data.goal,
      experience_level: data.experienceLevel,
      workout_location: data.workoutLocation,
      dietary_preference: data.dietPreference,
      activity_level: data.activityLevel,
      other_sports: data.otherSports,
      allergies: data.allergies,
      disliked_foods: data.dislikedFoods,
      weight_current: data.weight ? parseFloat(data.weight) : null,
      weight_goal: data.targetWeight ? parseFloat(data.targetWeight) : null,
      height_cm: data.height ? parseInt(data.height) : null,
      age: data.age ? parseInt(data.age) : null,
      workouts_per_week: data.workoutsPerWeek,
      daily_calorie_target: data.dailyCalorieTarget,
      daily_food_budget: data.dailyFoodBudget ? parseFloat(data.dailyFoodBudget) : null,
      cooking_style_preference: data.cookingStyle || 'cook_daily',
      meals_per_day: data.mealsPerDay,
      onboarding_completed: true,
    };

    // Use upsert to handle both new profiles and existing ones
    const { error } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });
    
    return { error };
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    if (user) {
      // User is logged in - save directly to profile
      try {
        const { error } = await saveOnboardingToProfile(user.id);
        if (error) throw error;

        toast({
          title: "You're all set! 🎉",
          description: "Your personalized plan is ready.",
        });
        navigate("/");
      } catch (error) {
        console.error("Error saving profile:", error);
        toast({
          title: "Something went wrong",
          description: "Please try again. If the issue persists, contact support.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // User is not logged in - store data and redirect to signup
      localStorage.setItem("pendingOnboarding", JSON.stringify(data));
      toast({
        title: "Almost there!",
        description: "Create an account to save your personalized plan.",
      });
      navigate("/auth?signup=true");
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const toggleSport = (sport: string) => {
    setData((prev) => ({
      ...prev,
      otherSports: prev.otherSports.includes(sport)
        ? prev.otherSports.filter((s) => s !== sport)
        : [...prev.otherSports, sport],
    }));
  };

  const toggleAllergy = (allergy: string) => {
    setData((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter((a) => a !== allergy)
        : [...prev.allergies, allergy],
    }));
  };

  const toggleDislikedFood = (food: string) => {
    setData((prev) => ({
      ...prev,
      dislikedFoods: prev.dislikedFoods.includes(food)
        ? prev.dislikedFoods.filter((f) => f !== food)
        : [...prev.dislikedFoods, food],
    }));
  };

  const getSuggestedCalories = () => {
    const baseCalories = 2000;
    const goalAdjustment = {
      lose_weight: -500,
      gain_muscle: 300,
      maintain: 0,
      improve_fitness: 0,
    };
    const activityAdjustment = {
      sedentary: -200,
      lightly_active: 0,
      moderately_active: 200,
      very_active: 400,
    };
    
    // Gender-based adjustment (physiological differences)
    let genderAdjustment = 0;
    if (data.gender === "male") genderAdjustment = 200;
    else if (data.gender === "female") genderAdjustment = -100;
    
    let suggested = baseCalories + genderAdjustment;
    if (data.goal) suggested += goalAdjustment[data.goal];
    if (data.activityLevel) suggested += activityAdjustment[data.activityLevel];
    
    // Add extra for sports activities
    if (data.otherSports.length > 0) {
      suggested += data.otherSports.length * 100;
    }
    
    return suggested;
  };

  return (
    <div className="dark">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-50">
        <div
          className="h-1 bg-primary transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step 1: Goal */}
      {step === 0 && (
        <OnboardingStep
          title="What's your main goal?"
          description="We'll create a personalized plan based on this."
          onNext={handleNext}
          isFirst
          canProceed={!!data.goal}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3">
              {goals.map(({ id, icon: Icon, label, description, color }) => (
                <button
                  key={id}
                  onClick={() => setData({ ...data, goal: id })}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                    data.goal === id
                      ? "border-primary bg-primary/10 scale-[1.02]"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className={cn("p-3 rounded-xl bg-background", data.goal === id && "bg-primary/20")}>
                    <Icon className={cn("h-6 w-6", color)} />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-foreground block">{label}</span>
                    <span className="text-sm text-muted-foreground">{description}</span>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    data.goal === id ? "border-primary bg-primary" : "border-muted-foreground"
                  )} />
                </button>
              ))}
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 2: Gender Identity */}
      {step === 1 && (
        <OnboardingStep
          title="How do you identify?"
          description="This helps us personalize training volume and nutrition estimates."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.gender}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {genderOptions.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setData({ ...data, gender: id })}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                    data.gender === id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="font-medium text-foreground flex-1">{label}</span>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    data.gender === id ? "border-primary bg-primary" : "border-muted-foreground"
                  )} />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              This information is used only to provide more accurate calorie and training estimates. 
              We respect your privacy and identity.
            </p>
          </div>
        </OnboardingStep>
      )}

      {/* Step 3: Body Stats + Activity Level */}
      {step === 2 && (
        <OnboardingStep
          title="About you"
          description="Help us calculate your ideal plan."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.weight && !!data.height && !!data.age && !!data.activityLevel}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Age</Label>
                <Input
                  type="number"
                  placeholder="25"
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value })}
                  className="bg-card h-11"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Height (cm)</Label>
                <Input
                  type="number"
                  placeholder="175"
                  value={data.height}
                  onChange={(e) => setData({ ...data, height: e.target.value })}
                  className="bg-card h-11"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</Label>
                <Input
                  type="number"
                  placeholder="75"
                  value={data.weight}
                  onChange={(e) => setData({ ...data, weight: e.target.value })}
                  className="bg-card h-11"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Goal weight (kg) - optional</Label>
              <Input
                type="number"
                placeholder="70"
                value={data.targetWeight}
                onChange={(e) => setData({ ...data, targetWeight: e.target.value })}
                className="bg-card h-11"
              />
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">Daily activity level</Label>
              <div className="space-y-2">
                {activityLevels.map(({ id, label, description, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, activityLevel: id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      data.activityLevel === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", data.activityLevel === id ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1">
                      <span className="font-medium text-foreground text-sm block">{label}</span>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 4: Workout Preferences + Sports */}
      {step === 3 && (
        <OnboardingStep
          title="Your training"
          description="How and where do you like to work out?"
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.experienceLevel && !!data.workoutLocation}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-2 block font-medium">Experience Level</Label>
              <div className="space-y-2">
                {experienceLevels.map(({ id, label, description, icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, experienceLevel: id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      data.experienceLevel === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <span className="text-xl">{icon}</span>
                    <div className="flex-1">
                      <span className="font-medium text-foreground text-sm block">{label}</span>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-2 block font-medium">Workout Location</Label>
              <div className="grid grid-cols-3 gap-2">
                {workoutLocations.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, workoutLocation: id })}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-xl border transition-all",
                      data.workoutLocation === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 mb-1", data.workoutLocation === id ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-2 block font-medium">
                Workouts per week: <span className="text-primary">{data.workoutsPerWeek}</span>
              </Label>
              <Slider
                value={[data.workoutsPerWeek]}
                onValueChange={(value) => setData({ ...data, workoutsPerWeek: value[0] })}
                min={1}
                max={7}
                step={1}
                className="py-4"
              />
            </div>

            <div>
              <Label className="text-foreground mb-2 block font-medium">Other sports you do? (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {sportsActivities.map(({ id, label, icon }) => (
                  <Button
                    key={id}
                    variant={data.otherSports.includes(id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSport(id)}
                    className="rounded-full"
                  >
                    <span className="mr-1">{icon}</span> {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This helps us plan recovery and avoid overtraining.
              </p>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 5: Diet + Budget */}
      {step === 4 && (
        <OnboardingStep
          title="Nutrition"
          description="We'll suggest meals you'll actually want to eat."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.dietPreference}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-2 block font-medium">Diet preference</Label>
              <div className="grid grid-cols-2 gap-2">
                {dietPreferences.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, dietPreference: id })}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                      data.dietPreference === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", data.dietPreference === id ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-2 block font-medium">Allergies (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {commonAllergies.map((allergy) => (
                  <Button
                    key={allergy}
                    variant={data.allergies.includes(allergy) ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleAllergy(allergy)}
                    className="rounded-full"
                  >
                    {allergy}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-2 block font-medium">Foods to avoid (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {commonDislikedFoods.map((food) => (
                  <Button
                    key={food}
                    variant={data.dislikedFoods.includes(food) ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleDislikedFood(food)}
                    className="rounded-full"
                  >
                    {food}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-2 block font-medium">Daily food budget (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="15"
                  value={data.dailyFoodBudget}
                  onChange={(e) => setData({ ...data, dailyFoodBudget: e.target.value })}
                  className="bg-card h-11 pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">We'll suggest affordable meals within your budget.</p>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 6: Cooking Style & Meals Per Day */}
      {step === 5 && (
        <OnboardingStep
          title="How do you like to cook?"
          description="This shapes how your meal plan is structured."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.cookingStyle}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-3 block font-medium">Cooking style</Label>
              <div className="space-y-3">
                <button
                  onClick={() => setData({ ...data, cookingStyle: "cook_daily" })}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                    data.cookingStyle === "cook_daily"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl">🍳</span>
                  <div className="flex-1">
                    <span className="font-semibold text-foreground block">Cook Daily</span>
                    <span className="text-xs text-muted-foreground">Fresh meals every day, more variety</span>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    data.cookingStyle === "cook_daily" ? "border-primary bg-primary" : "border-muted-foreground"
                  )} />
                </button>
                <button
                  onClick={() => setData({ ...data, cookingStyle: "batch_cook_weekly" })}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                    data.cookingStyle === "batch_cook_weekly"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl">🥘</span>
                  <div className="flex-1">
                    <span className="font-semibold text-foreground block">Batch Cook Weekly</span>
                    <span className="text-xs text-muted-foreground">Prep once, eat for days — less time cooking</span>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    data.cookingStyle === "batch_cook_weekly" ? "border-primary bg-primary" : "border-muted-foreground"
                  )} />
                </button>
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">
                Meals per day: <span className="text-primary">{data.mealsPerDay}</span>
              </Label>
              <Slider
                value={[data.mealsPerDay]}
                onValueChange={(value) => setData({ ...data, mealsPerDay: value[0] })}
                min={2}
                max={5}
                step={1}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>2 meals</span>
                <span>5 meals</span>
              </div>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 7: Calorie Target + Review */}
      {step === 6 && (
        <OnboardingStep
          title="Your daily target"
          description="Adjust based on your preferences."
          onNext={handleComplete}
          onBack={handleBack}
          isLast
          canProceed={!isLoading}
        >
          <div className="space-y-6">
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground mb-2">Recommended calories</p>
              <p className="text-5xl font-bold text-primary">{getSuggestedCalories()}</p>
              <p className="text-sm text-muted-foreground mt-2">kcal / day</p>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">
                Adjust: <span className="text-primary">{data.dailyCalorieTarget} kcal</span>
              </Label>
              <Slider
                value={[data.dailyCalorieTarget]}
                onValueChange={(value) => setData({ ...data, dailyCalorieTarget: value[0] })}
                min={1200}
                max={4000}
                step={50}
                className="py-4"
              />
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-2 text-primary"
                onClick={() => setData({ ...data, dailyCalorieTarget: getSuggestedCalories() })}
              >
                Use recommended ({getSuggestedCalories()} kcal)
              </Button>
            </div>

            <div className="rounded-xl bg-card border border-border p-4 space-y-2">
              <p className="font-medium text-foreground text-sm">Summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goal:</span>
                  <span className="text-foreground capitalize">{data.goal?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level:</span>
                  <span className="text-foreground capitalize">{data.experienceLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Workouts:</span>
                  <span className="text-foreground">{data.workoutsPerWeek}x/week</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="text-foreground capitalize">{data.workoutLocation}</span>
                </div>
                {data.otherSports.length > 0 && (
                  <div className="col-span-2 flex justify-between">
                    <span className="text-muted-foreground">Sports:</span>
                    <span className="text-foreground">{data.otherSports.length} activities</span>
                  </div>
                )}
              </div>
            </div>

            {/* Wellness Disclaimer */}
            <div className="rounded-xl bg-muted/50 border border-border p-3">
              <p className="text-xs text-muted-foreground text-center">
                Forme provides general wellness guidance and is not a substitute for professional medical advice. 
                Consult a healthcare provider before starting any new fitness or nutrition program.
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center mt-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Creating your personalized plan...</span>
            </div>
          )}
        </OnboardingStep>
      )}
    </div>
  );
}
