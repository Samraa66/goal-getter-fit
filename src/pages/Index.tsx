import { AppLayout } from "@/components/layout/AppLayout";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { MealCard } from "@/components/meals/MealCard";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { Button } from "@/components/ui/button";
import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  // Mock data - will be replaced with real data
  const todayStats = {
    calories: { consumed: 1450, target: 2000 },
    protein: { consumed: 85, target: 150 },
    water: { consumed: 2.1, target: 3 },
    streak: 7,
  };

  const calorieProgress = (todayStats.calories.consumed / todayStats.calories.target) * 100;

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-6">
          <p className="text-muted-foreground">Good morning,</p>
          <h1 className="text-2xl font-bold text-foreground">Alex</h1>
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
            {todayStats.calories.target - todayStats.calories.consumed} kcal remaining
          </p>
        </div>

        {/* Quick Stats */}
        <div className="px-6 py-4">
          <QuickStats {...todayStats} />
        </div>

        {/* AI Coach Prompt */}
        <div className="px-6 py-4">
          <Link to="/coach">
            <div className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4 animate-pulse-glow">
              <div className="rounded-full bg-primary p-3">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">AI Coach</h3>
                <p className="text-sm text-muted-foreground">Ask me anything about your fitness journey</p>
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
            <MealCard
              type="breakfast"
              name="Greek Yogurt Bowl"
              calories={350}
              protein={25}
              carbs={40}
              fats={12}
              time="8:00 AM"
            />
            <MealCard
              type="lunch"
              name="Grilled Chicken Salad"
              calories={450}
              protein={35}
              carbs={25}
              fats={18}
              time="12:30 PM"
            />
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
          <WorkoutCard
            name="Upper Body Strength"
            type="strength"
            duration={45}
            calories={300}
            exercises={8}
            onStart={() => console.log("Start workout")}
          />
        </div>
      </div>
    </AppLayout>
  );
}
