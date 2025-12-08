import { useState } from "react";
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
  User,
  Apple,
  Leaf,
  Flame,
  Beef
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Goal = "lose_weight" | "gain_muscle" | "maintain" | "improve_fitness";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type WorkoutLocation = "gym" | "home" | "both";
type DietPreference = "none" | "vegetarian" | "vegan" | "keto" | "paleo";
type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active";

interface OnboardingData {
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  workoutLocation: WorkoutLocation | null;
  dietPreference: DietPreference | null;
  activityLevel: ActivityLevel | null;
  allergies: string[];
  dislikedFoods: string[];
  weight: string;
  targetWeight: string;
  height: string;
  age: string;
  workoutsPerWeek: number;
  dailyCalorieTarget: number;
  dailyFoodBudget: string;
}

const goals = [
  { id: "lose_weight" as Goal, icon: Scale, label: "Lose Weight", description: "Burn fat & get lean", color: "text-orange-500" },
  { id: "gain_muscle" as Goal, icon: Dumbbell, label: "Build Muscle", description: "Gain strength & size", color: "text-blue-500" },
  { id: "maintain" as Goal, icon: Target, label: "Maintain", description: "Keep current physique", color: "text-green-500" },
  { id: "improve_fitness" as Goal, icon: Heart, label: "Get Healthier", description: "Improve overall wellness", color: "text-pink-500" },
];

const experienceLevels = [
  { id: "beginner" as ExperienceLevel, label: "Just Starting", description: "New to working out or returning after a long break", icon: "🌱" },
  { id: "intermediate" as ExperienceLevel, label: "Some Experience", description: "Workout regularly for 6+ months", icon: "💪" },
  { id: "advanced" as ExperienceLevel, label: "Experienced", description: "2+ years of consistent training", icon: "🔥" },
];

const workoutLocations = [
  { id: "gym" as WorkoutLocation, label: "Gym", description: "Access to full equipment", icon: Building2 },
  { id: "home" as WorkoutLocation, label: "Home", description: "Minimal or no equipment", icon: Home },
  { id: "both" as WorkoutLocation, label: "Mix", description: "Flexible between both", icon: Shuffle },
];

const activityLevels = [
  { id: "sedentary" as ActivityLevel, label: "Sedentary", description: "Desk job, minimal movement", icon: Moon },
  { id: "lightly_active" as ActivityLevel, label: "Lightly Active", description: "Some walking, light activity", icon: Clock },
  { id: "moderately_active" as ActivityLevel, label: "Moderately Active", description: "Regular exercise or active job", icon: Zap },
  { id: "very_active" as ActivityLevel, label: "Very Active", description: "Intense exercise or physical job", icon: Flame },
];

const dietPreferences = [
  { id: "none" as DietPreference, label: "No Restrictions", icon: Utensils },
  { id: "vegetarian" as DietPreference, label: "Vegetarian", icon: Apple },
  { id: "vegan" as DietPreference, label: "Vegan", icon: Leaf },
  { id: "keto" as DietPreference, label: "Keto", icon: Beef },
  { id: "paleo" as DietPreference, label: "Paleo", icon: Flame },
];

const commonAllergies = ["Dairy", "Gluten", "Nuts", "Shellfish", "Eggs", "Soy", "Fish", "Wheat"];
const commonDislikedFoods = ["Broccoli", "Spinach", "Mushrooms", "Tofu", "Fish", "Liver", "Brussels Sprouts", "Avocado"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    goal: null,
    experienceLevel: null,
    workoutLocation: null,
    dietPreference: null,
    activityLevel: null,
    allergies: [],
    dislikedFoods: [],
    weight: "",
    targetWeight: "",
    height: "",
    age: "",
    workoutsPerWeek: 3,
    dailyCalorieTarget: 2000,
    dailyFoodBudget: "",
  });

  const totalSteps = 6;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          fitness_goal: data.goal,
          experience_level: data.experienceLevel,
          workout_location: data.workoutLocation,
          dietary_preference: data.dietPreference,
          allergies: data.allergies,
          disliked_foods: data.dislikedFoods,
          weight_current: data.weight ? parseFloat(data.weight) : null,
          weight_goal: data.targetWeight ? parseFloat(data.targetWeight) : null,
          height_cm: data.height ? parseInt(data.height) : null,
          age: data.age ? parseInt(data.age) : null,
          daily_calorie_target: data.dailyCalorieTarget,
          daily_food_budget: data.dailyFoodBudget ? parseFloat(data.dailyFoodBudget) : null,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "You're all set! 🎉",
        description: "Your personalized plan is ready.",
      });
      navigate("/");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
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

  // Calculate suggested calories based on goal
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
    
    let suggested = baseCalories;
    if (data.goal) suggested += goalAdjustment[data.goal];
    if (data.activityLevel) suggested += activityAdjustment[data.activityLevel];
    
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

      {/* Step 1: Welcome & Goal */}
      {step === 0 && (
        <OnboardingStep
          title="What's your main goal?"
          description="This helps us create a personalized plan just for you."
          onNext={handleNext}
          isFirst
          canProceed={!!data.goal}
        >
          <div className="grid grid-cols-1 gap-3">
            {goals.map(({ id, icon: Icon, label, description, color }) => (
              <button
                key={id}
                onClick={() => setData({ ...data, goal: id })}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                  data.goal === id
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
                )}
              >
                <div className={cn("p-3 rounded-xl bg-background", data.goal === id && "bg-primary/20")}>
                  <Icon className={cn("h-6 w-6", color)} />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-foreground block">{label}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </div>
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    data.goal === id 
                      ? "border-primary bg-primary" 
                      : "border-muted-foreground"
                  )}
                />
              </button>
            ))}
          </div>
        </OnboardingStep>
      )}

      {/* Step 2: About You - Body Stats */}
      {step === 1 && (
        <OnboardingStep
          title="Tell us about yourself"
          description="This helps us calculate your ideal nutrition plan."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.weight && !!data.height && !!data.age}
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
              <div className="p-3 rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your information is kept private and used only to personalize your experience.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="age" className="text-foreground text-sm mb-2 block">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value })}
                  className="bg-card text-lg h-12"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-foreground text-sm mb-2 block">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={data.height}
                  onChange={(e) => setData({ ...data, height: e.target.value })}
                  className="bg-card text-lg h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight" className="text-foreground text-sm mb-2 block">Current Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="75"
                  value={data.weight}
                  onChange={(e) => setData({ ...data, weight: e.target.value })}
                  className="bg-card text-lg h-12"
                />
              </div>
              <div>
                <Label htmlFor="targetWeight" className="text-foreground text-sm mb-2 block">Goal Weight (kg)</Label>
                <Input
                  id="targetWeight"
                  type="number"
                  placeholder="70"
                  value={data.targetWeight}
                  onChange={(e) => setData({ ...data, targetWeight: e.target.value })}
                  className="bg-card text-lg h-12"
                />
              </div>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 3: Activity Level */}
      {step === 2 && (
        <OnboardingStep
          title="How active are you?"
          description="Outside of planned workouts, how much do you move?"
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.activityLevel}
        >
          <div className="space-y-3">
            {activityLevels.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setData({ ...data, activityLevel: id })}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                  data.activityLevel === id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  data.activityLevel === id ? "bg-primary/20" : "bg-background"
                )}>
                  <Icon className={cn(
                    "h-5 w-5",
                    data.activityLevel === id ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-foreground block">{label}</span>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2",
                    data.activityLevel === id 
                      ? "border-primary bg-primary" 
                      : "border-muted-foreground"
                  )}
                />
              </button>
            ))}
          </div>
        </OnboardingStep>
      )}

      {/* Step 4: Workout Preferences */}
      {step === 3 && (
        <OnboardingStep
          title="Your workout style"
          description="How do you prefer to train?"
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.experienceLevel && !!data.workoutLocation}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-3 block font-medium">Experience Level</Label>
              <div className="space-y-2">
                {experienceLevels.map(({ id, label, description, icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, experienceLevel: id })}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                      data.experienceLevel === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1">
                      <span className="font-medium text-foreground block">{label}</span>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full border-2",
                        data.experienceLevel === id 
                          ? "border-primary bg-primary" 
                          : "border-muted-foreground"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">Where will you work out?</Label>
              <div className="grid grid-cols-3 gap-3">
                {workoutLocations.map(({ id, label, description, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, workoutLocation: id })}
                    className={cn(
                      "flex flex-col items-center p-4 rounded-xl border transition-all",
                      data.workoutLocation === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6 mb-2",
                      data.workoutLocation === id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-foreground text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 day</span>
                <span>7 days</span>
              </div>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 5: Diet Preferences */}
      {step === 4 && (
        <OnboardingStep
          title="Your eating preferences"
          description="Help us create meals you'll actually enjoy."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.dietPreference}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-3 block font-medium">Diet Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {dietPreferences.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, dietPreference: id })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      data.dietPreference === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5",
                      data.dietPreference === id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "font-medium text-sm",
                      data.dietPreference === id ? "text-foreground" : "text-muted-foreground"
                    )}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">Any allergies?</Label>
              <div className="flex flex-wrap gap-2">
                {commonAllergies.map((allergy) => (
                  <Button
                    key={allergy}
                    variant={data.allergies.includes(allergy) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAllergy(allergy)}
                    className={cn(
                      "rounded-full",
                      data.allergies.includes(allergy) && "bg-destructive hover:bg-destructive/90"
                    )}
                  >
                    {allergy}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">Foods you don't like?</Label>
              <div className="flex flex-wrap gap-2">
                {commonDislikedFoods.map((food) => (
                  <Button
                    key={food}
                    variant={data.dislikedFoods.includes(food) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDislikedFood(food)}
                    className={cn(
                      "rounded-full",
                      data.dislikedFoods.includes(food) && "bg-orange-500 hover:bg-orange-600"
                    )}
                  >
                    {food}
                  </Button>
                ))}
            </div>

            <div>
              <Label htmlFor="budget" className="text-foreground mb-3 block font-medium">
                Daily food budget (optional)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="budget"
                  type="number"
                  placeholder="15"
                  value={data.dailyFoodBudget}
                  onChange={(e) => setData({ ...data, dailyFoodBudget: e.target.value })}
                  className="bg-card text-lg h-12 pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Set a budget to get affordable meal suggestions that won't break the bank.
              </p>
            </div>
          </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 6: Calorie Target & Review */}
      {step === 5 && (
        <OnboardingStep
          title="Your daily calorie target"
          description="We've calculated a suggested target based on your goals."
          onNext={handleComplete}
          onBack={handleBack}
          isLast
          canProceed={!isLoading}
        >
          <div className="space-y-6">
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground mb-2">Recommended daily calories</p>
              <p className="text-5xl font-bold text-primary">{getSuggestedCalories()}</p>
              <p className="text-sm text-muted-foreground mt-2">kcal / day</p>
            </div>

            <div>
              <Label className="text-foreground mb-3 block font-medium">
                Adjust if needed: <span className="text-primary">{data.dailyCalorieTarget} kcal</span>
              </Label>
              <Slider
                value={[data.dailyCalorieTarget]}
                onValueChange={(value) => setData({ ...data, dailyCalorieTarget: value[0] })}
                min={1200}
                max={4000}
                step={50}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1,200</span>
                <span>4,000</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-2 text-primary"
                onClick={() => setData({ ...data, dailyCalorieTarget: getSuggestedCalories() })}
              >
                Use recommended ({getSuggestedCalories()} kcal)
              </Button>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-card border border-border p-4 space-y-3">
              <p className="font-medium text-foreground">Your Plan Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
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
                  <span className="text-muted-foreground">Diet:</span>
                  <span className="text-foreground capitalize">{data.dietPreference === 'none' ? 'Flexible' : data.dietPreference}</span>
                </div>
              </div>
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