import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { MealCard } from "@/components/meals/MealCard";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { Button } from "@/components/ui/button";
import { ChevronRight, Sparkles, Loader2, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTemplateMeals } from "@/hooks/useTemplateMeals";
import { useTemplateWorkouts } from "@/hooks/useTemplateWorkouts";
import { useStreak } from "@/hooks/useStreak";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MealStructure, WorkoutStructure } from "@/types/templates";

const mealTypeOrder = ["breakfast", "lunch", "snack", "dinner"];

export default function Index() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { userMeals, isLoading: mealsLoading, toggleComplete, refetch: refetchMeals, consumedCalories, consumedProtein } = useTemplateMeals();
  const { userWorkouts, todayWorkout, isLoading: workoutsLoading } = useTemplateWorkouts();
  const { currentStreak, isLoading: streakLoading, refetch: refetchStreak } = useStreak();
  const { glasses, liters, targetLiters, addWater, isLoading: waterLoading } = useWaterIntake();

  const [profile, setProfile] = useState<{ full_name?: string; daily_calorie_target?: number } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, daily_calorie_target")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data);
    }
    fetchProfile();
  }, [user]);

  const targetCalories = profile?.daily_calorie_target || 2000;
  const targetProtein = Math.round(targetCalories * 0.3 / 4);

  const todayStats = {
    calories: { consumed: consumedCalories, target: targetCalories },
    protein: { consumed: consumedProtein, target: targetProtein },
    water: { consumed: liters, target: targetLiters },
    streak: currentStreak,
  };

  const calorieProgress = Math.min((todayStats.calories.consumed / todayStats.calories.target) * 100, 100);

  // Get first two meals to display
  const mealsToDisplay = [...userMeals]
    .sort((a, b) => mealTypeOrder.indexOf(a.meal_type) - mealTypeOrder.indexOf(b.meal_type))
    .slice(0, 2);

  // Map today workout for display
  const mappedTodayWorkout = todayWorkout
    ? {
        name: (todayWorkout.personalized_data as WorkoutStructure)?.workout_name || "Workout",
        type: "strength" as const,
        duration: 45,
        exercises: (todayWorkout.personalized_data as WorkoutStructure)?.exercises?.length || 0,
        completed: todayWorkout.is_completed,
      }
    : null;

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out", description: "See you next time!" });
    navigate("/auth");
  };

  const handleMealToggle = async (mealId: string, completed: boolean) => {
    await toggleComplete(mealId, completed);
    if (completed) {
      await refetchStreak();
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        {/* Header */}
        <div className="px-6 pt-12 pb-6 flex items-start justify-between">
          <div>
            <p className="text-muted-foreground">{greeting},</p>
            <h1 className="text-2xl font-bold text-foreground">{firstName}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Progress Ring */}
        <div className="flex flex-col items-center py-6">
          <ProgressRing
            progress={calorieProgress}
            size={160}
            strokeWidth={12}
            label="Daily Calories"
            value={`${todayStats.calories.consumed}`}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {Math.max(0, todayStats.calories.target - todayStats.calories.consumed)} kcal remaining
          </p>
        </div>

        {/* Quick Stats */}
        <div className="px-6 py-4">
          <QuickStats {...todayStats} onAddWater={() => addWater(1)} />
        </div>

        {/* AI Coach Prompt */}
        <div className="px-6 py-4">
          <Link to="/coach">
            <div className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4 animate-pulse-glow">
              <div className="rounded-full bg-primary p-3">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Forme Coach</h3>
                <p className="text-sm text-muted-foreground">Adjust your Forme for this week</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        </div>

        {/* Today's Meals */}
        <div className="px-6 py-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Today's Meals</h2>
            <Link to="/meals">
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {mealsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : mealsToDisplay.length > 0 ? (
              mealsToDisplay.map((meal) => {
                const data = meal.personalized_data as MealStructure;
                return (
                  <MealCard
                    key={meal.id}
                    id={meal.id}
                    type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                    name={data?.meal_name || "Meal"}
                    calories={meal.total_calories || 0}
                    protein={meal.total_protein || 0}
                    carbs={meal.total_carbs || 0}
                    fats={meal.total_fats || 0}
                    ingredients={data?.ingredients}
                    isCompleted={meal.is_completed}
                    onToggleComplete={(completed) => handleMealToggle(meal.id, completed)}
                  />
                );
              })
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">No meals planned yet</p>
                <Button size="sm" onClick={() => navigate("/meals")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Plan
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Today's Workout */}
        <div className="px-6 py-4 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Today's Workout</h2>
            <Link to="/workouts">
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {workoutsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : mappedTodayWorkout ? (
            <WorkoutCard
              name={mappedTodayWorkout.name}
              type={mappedTodayWorkout.type}
              duration={mappedTodayWorkout.duration}
              calories={300}
              exercises={mappedTodayWorkout.exercises}
              completed={mappedTodayWorkout.completed}
              onStart={mappedTodayWorkout.completed ? undefined : () => navigate("/workouts")}
            />
          ) : userWorkouts.length > 0 ? (
            <div className="text-center py-6 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Rest day! No workout scheduled.</p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No workout program yet</p>
              <Button size="sm" onClick={() => navigate("/workouts")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Program
              </Button>
            </div>
          )}
        </div>

        <div className="h-6" />
      </PageContainer>
    </AppLayout>
  );
}
