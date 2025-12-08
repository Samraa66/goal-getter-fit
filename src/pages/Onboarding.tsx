import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Target, Utensils, Dumbbell, Scale, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Goal = "lose_weight" | "gain_muscle" | "maintain" | "improve_fitness";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type WorkoutLocation = "gym" | "home" | "both";
type DietPreference = "none" | "vegetarian" | "vegan" | "keto" | "paleo";

interface OnboardingData {
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  workoutLocation: WorkoutLocation | null;
  dietPreference: DietPreference | null;
  allergies: string[];
  weight: string;
  targetWeight: string;
  height: string;
  age: string;
}

const goals = [
  { id: "lose_weight" as Goal, icon: Scale, label: "Lose Weight", description: "Shed extra pounds" },
  { id: "gain_muscle" as Goal, icon: Dumbbell, label: "Build Muscle", description: "Gain lean mass" },
  { id: "maintain" as Goal, icon: Target, label: "Maintain", description: "Stay where you are" },
  { id: "improve_fitness" as Goal, icon: Utensils, label: "Improve Fitness", description: "Get healthier" },
];

const experienceLevels = [
  { id: "beginner" as ExperienceLevel, label: "Beginner", description: "New to fitness" },
  { id: "intermediate" as ExperienceLevel, label: "Intermediate", description: "Some experience" },
  { id: "advanced" as ExperienceLevel, label: "Advanced", description: "Very experienced" },
];

const workoutLocations = [
  { id: "gym" as WorkoutLocation, label: "Gym", description: "Full equipment access" },
  { id: "home" as WorkoutLocation, label: "Home", description: "Limited equipment" },
  { id: "both" as WorkoutLocation, label: "Both", description: "Mix of both" },
];

const dietPreferences = [
  { id: "none" as DietPreference, label: "No Preference" },
  { id: "vegetarian" as DietPreference, label: "Vegetarian" },
  { id: "vegan" as DietPreference, label: "Vegan" },
  { id: "keto" as DietPreference, label: "Keto" },
  { id: "paleo" as DietPreference, label: "Paleo" },
];

const commonAllergies = ["Dairy", "Gluten", "Nuts", "Shellfish", "Eggs", "Soy"];

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
    allergies: [],
    weight: "",
    targetWeight: "",
    height: "",
    age: "",
  });

  const totalSteps = 4;

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
          weight_current: data.weight ? parseFloat(data.weight) : null,
          weight_goal: data.targetWeight ? parseFloat(data.targetWeight) : null,
          height_cm: data.height ? parseInt(data.height) : null,
          age: data.age ? parseInt(data.age) : null,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile complete!",
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

  return (
    <div className="dark">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-50">
        <div
          className="h-1 bg-primary transition-all duration-300"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step 1: Goal */}
      {step === 0 && (
        <OnboardingStep
          title="What's your goal?"
          description="We'll personalize your plan based on what you want to achieve."
          onNext={handleNext}
          isFirst
          canProceed={!!data.goal}
        >
          <div className="grid grid-cols-2 gap-3">
            {goals.map(({ id, icon: Icon, label, description }) => (
              <button
                key={id}
                onClick={() => setData({ ...data, goal: id })}
                className={cn(
                  "flex flex-col items-center p-4 rounded-xl border transition-all",
                  data.goal === id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <Icon className={cn("h-8 w-8 mb-2", data.goal === id ? "text-primary" : "text-muted-foreground")} />
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground text-center">{description}</span>
              </button>
            ))}
          </div>
        </OnboardingStep>
      )}

      {/* Step 2: Experience & Location */}
      {step === 1 && (
        <OnboardingStep
          title="Your fitness level"
          description="This helps us create the right workout intensity."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.experienceLevel && !!data.workoutLocation}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-3 block">Experience Level</Label>
              <div className="space-y-2">
                {experienceLevels.map(({ id, label, description }) => (
                  <button
                    key={id}
                    onClick={() => setData({ ...data, experienceLevel: id })}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                      data.experienceLevel === id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className="text-left">
                      <span className="font-medium text-foreground">{label}</span>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full border-2",
                        data.experienceLevel === id ? "border-primary bg-primary" : "border-muted-foreground"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block">Workout Location</Label>
              <div className="flex flex-wrap gap-2">
                {workoutLocations.map(({ id, label }) => (
                  <Button
                    key={id}
                    variant={data.workoutLocation === id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setData({ ...data, workoutLocation: id })}
                    className={data.workoutLocation === id ? "gradient-primary" : ""}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 3: Diet & Allergies */}
      {step === 2 && (
        <OnboardingStep
          title="Dietary preferences"
          description="Let us know about any dietary restrictions or preferences."
          onNext={handleNext}
          onBack={handleBack}
          canProceed={!!data.dietPreference}
        >
          <div className="space-y-6">
            <div>
              <Label className="text-foreground mb-3 block">Diet Type</Label>
              <div className="flex flex-wrap gap-2">
                {dietPreferences.map(({ id, label }) => (
                  <Button
                    key={id}
                    variant={data.dietPreference === id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setData({ ...data, dietPreference: id })}
                    className={data.dietPreference === id ? "gradient-primary" : ""}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-foreground mb-3 block">Allergies (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {commonAllergies.map((allergy) => (
                  <Button
                    key={allergy}
                    variant={data.allergies.includes(allergy) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAllergy(allergy)}
                    className={data.allergies.includes(allergy) ? "bg-destructive hover:bg-destructive/90" : ""}
                  >
                    {allergy}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </OnboardingStep>
      )}

      {/* Step 4: Body Stats */}
      {step === 3 && (
        <OnboardingStep
          title="Your body stats"
          description="Enter your current measurements to personalize your plan."
          onNext={handleComplete}
          onBack={handleBack}
          isLast
          canProceed={!!data.weight && !!data.height && !isLoading}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight" className="text-foreground">Current Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="75"
                  value={data.weight}
                  onChange={(e) => setData({ ...data, weight: e.target.value })}
                  className="mt-1 bg-card"
                />
              </div>

              <div>
                <Label htmlFor="targetWeight" className="text-foreground">Target Weight (kg)</Label>
                <Input
                  id="targetWeight"
                  type="number"
                  placeholder="70"
                  value={data.targetWeight}
                  onChange={(e) => setData({ ...data, targetWeight: e.target.value })}
                  className="mt-1 bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="height" className="text-foreground">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={data.height}
                  onChange={(e) => setData({ ...data, height: e.target.value })}
                  className="mt-1 bg-card"
                />
              </div>

              <div>
                <Label htmlFor="age" className="text-foreground">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value })}
                  className="mt-1 bg-card"
                />
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Saving your profile...</span>
            </div>
          )}
        </OnboardingStep>
      )}
    </div>
  );
}
