import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { ActiveWorkout } from "@/components/workouts/ActiveWorkout";
import { WorkoutComplete } from "@/components/workouts/WorkoutComplete";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Loader2, Sparkles } from "lucide-react";
import { useWorkoutProgram } from "@/hooks/useWorkoutProgram";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Workouts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("today");
  const [activeWorkout, setActiveWorkout] = useState<{
    id: string;
    name: string;
    workoutType: string;
    exercises: any[];
    duration: number;
  } | null>(null);
  const [showComplete, setShowComplete] = useState<{
    name: string;
    duration: number;
    calories: number;
    exercises: number;
  } | null>(null);

  const { 
    program, 
    isLoading, 
    isGenerating, 
    generateProgram, 
    completeWorkout,
    completeExercise 
  } = useWorkoutProgram();

  const today = new Date().getDay();
  const todayWorkout = program?.workouts.find(w => w.day_of_week === today);
  const completedThisWeek = program?.workouts.filter(w => w.is_completed).length || 0;

  const handleStartWorkout = (workout: any) => {
    // Don't start workout if no exercises
    if (!workout.exercises || workout.exercises.length === 0) {
      return;
    }
    setActiveWorkout({
      id: workout.id,
      name: workout.name,
      workoutType: workout.workout_type,
      exercises: workout.exercises,
      duration: workout.duration_minutes,
    });
  };

  const handleSwapExercise = async (exerciseId: string, reason: string) => {
    if (!activeWorkout || !user) return null;
    
    const currentExercise = activeWorkout.exercises.find(e => e.id === exerciseId);
    if (!currentExercise) return null;

    try {
      // Get user profile for context
      const { data: profile } = await supabase
        .from("profiles")
        .select("experience_level, workout_location")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase.functions.invoke("swap-exercise", {
        body: {
          currentExercise,
          reason,
          profile,
          workoutType: activeWorkout.workoutType,
        },
      });

      if (error) throw error;

      // Return the new exercise with the same ID so it replaces the old one
      const newExercise = {
        ...data,
        id: exerciseId,
        is_completed: false,
      };

      toast({
        title: "Exercise swapped!",
        description: `Try ${data.name} instead`,
      });

      return newExercise;
    } catch (error) {
      console.error("Error swapping exercise:", error);
      toast({
        title: "Couldn't find alternative",
        description: "Please try again",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleWorkoutComplete = async () => {
    if (!activeWorkout) return;
    
    await completeWorkout(activeWorkout.id);
    
    const workout = program?.workouts.find(w => w.id === activeWorkout.id);
    setShowComplete({
      name: activeWorkout.name,
      duration: activeWorkout.duration,
      calories: 300, // Estimate
      exercises: activeWorkout.exercises.length,
    });
    setActiveWorkout(null);
  };

  const handleCloseComplete = () => {
    setShowComplete(null);
  };

  if (activeWorkout) {
    return (
      <ActiveWorkout
        workoutName={activeWorkout.name}
        exercises={activeWorkout.exercises}
        onComplete={handleWorkoutComplete}
        onClose={() => setActiveWorkout(null)}
        onExerciseComplete={completeExercise}
        onSwapExercise={handleSwapExercise}
      />
    );
  }

  if (showComplete) {
    return (
      <WorkoutComplete
        workoutName={showComplete.name}
        duration={showComplete.duration}
        caloriesBurned={showComplete.calories}
        exercisesCompleted={showComplete.exercises}
        onClose={handleCloseComplete}
      />
    );
  }

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Workouts</h1>
          <p className="text-muted-foreground">Your training schedule</p>
        </div>

        {/* Progress Bar */}
        {program && (
          <div className="mx-6 mb-4 rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Weekly Progress</span>
              <span className="text-sm font-medium text-primary">{completedThisWeek}/7 workouts</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(completedThisWeek / 7) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 px-6 mb-6">
          <Button variant="outline" className="flex-1">
            <TrendingUp className="mr-2 h-4 w-4" />
            Progress
          </Button>
          <Button variant="outline" className="flex-1">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
            <TabsTrigger value="week" className="flex-1">This Week</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : todayWorkout ? (
              <>
                <WorkoutCard
                  name={todayWorkout.name}
                  type={todayWorkout.workout_type}
                  duration={todayWorkout.duration_minutes}
                  calories={300}
                  exercises={todayWorkout.exercises.length}
                  completed={todayWorkout.is_completed}
                  onStart={todayWorkout.is_completed ? undefined : () => handleStartWorkout(todayWorkout)}
                />
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={generateProgram}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate New Program
                </Button>
              </>
            ) : program ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Rest day! No workout scheduled for today.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No workout program yet</p>
                <Button 
                  className="gradient-primary" 
                  onClick={generateProgram}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Workout Program
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : program?.workouts && program.workouts.length > 0 ? (
              program.workouts
                .slice()
                .sort((a, b) => a.day_of_week - b.day_of_week)
                .map((workout) => (
                  <div key={workout.id} className="flex items-center gap-3">
                    <div className="w-10 text-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        {dayNames[workout.day_of_week]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <WorkoutCard
                        name={workout.name}
                        type={workout.workout_type}
                        duration={workout.duration_minutes}
                        calories={300}
                        exercises={workout.exercises.length}
                        completed={workout.is_completed}
                        onStart={workout.is_completed ? undefined : () => handleStartWorkout(workout)}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No workout program yet</p>
                <Button 
                  className="gradient-primary" 
                  onClick={generateProgram}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Workout Program
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">View your workout history and stats</p>
              <Button className="mt-4 gradient-primary">View History</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
