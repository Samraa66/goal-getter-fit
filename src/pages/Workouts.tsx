import { useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { ActiveWorkout } from "@/components/workouts/ActiveWorkout";
import { WorkoutComplete } from "@/components/workouts/WorkoutComplete";
import { WorkoutProgress } from "@/components/workouts/WorkoutProgress";
import { WorkoutSchedule } from "@/components/workouts/WorkoutSchedule";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Loader2, Sparkles, Edit3, Lock, Flame, Dumbbell, Clock, Leaf } from "lucide-react";
import { RestDayCard } from "@/components/workouts/RestDayCard";
import { useWorkoutProgram } from "@/hooks/useWorkoutProgram";
import { useWorkoutHistory } from "@/hooks/useWorkoutHistory";
import { useStreak } from "@/hooks/useStreak";
import { usePlanRefresh } from "@/hooks/usePlanRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Workouts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("today");
  const [showCustomOption, setShowCustomOption] = useState(false);
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
  const [showProgress, setShowProgress] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const { 
    program, 
    isLoading, 
    isGenerating, 
    generateProgram, 
    completeWorkout,
    completeExercise,
    refetch: refetchProgram
  } = useWorkoutProgram();

  // Listen for refresh events from Coach AI
  const handleWorkoutsRefresh = useCallback(() => {
    console.log("Workouts page: Received refresh event, refetching...");
    refetchProgram();
  }, [refetchProgram]);
  
  usePlanRefresh(undefined, handleWorkoutsRefresh);

  const { completedWorkouts, isLoading: isLoadingHistory } = useWorkoutHistory();
  const { currentStreak, todayComplete, workoutDone, mealsDone, refetch: refetchStreak } = useStreak();

  // Cache program to prevent data loss on tab switches
  const cachedProgram = useRef(program);
  if (program) {
    cachedProgram.current = program;
  }
  const displayProgram = program || cachedProgram.current;

  const today = new Date().getDay();
  const todayWorkout = displayProgram?.workouts.find(w => w.day_of_week === today);
  const completedThisWeek = displayProgram?.workouts.filter(w => w.is_completed).length || 0;

  const canStartWorkout = (workout: any) => {
    if (workout.is_completed) return false;
    if (workout.day_of_week !== today) return false;
    return true;
  };

  const isWorkoutLocked = (workout: any) => {
    if (workout.is_completed) return false;
    return workout.day_of_week !== today;
  };

  const handleStartWorkout = (workout: any) => {
    if (!canStartWorkout(workout)) {
      if (workout.day_of_week !== today) {
        toast({
          title: "Not available yet",
          description: "This workout is scheduled for another day. Focus on today's workout!",
        });
      }
      return;
    }
    
    if (!workout.exercises || workout.exercises.length === 0) {
      toast({
        title: "No exercises found",
        description: "This workout doesn't have any exercises. Try regenerating your program.",
        variant: "destructive",
      });
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
    
    // Refetch streak after completing workout
    await refetchStreak();
    
    setShowComplete({
      name: activeWorkout.name,
      duration: activeWorkout.duration,
      calories: 300,
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

  if (showProgress) {
    return (
      <WorkoutProgress
        completedWorkouts={completedWorkouts}
        currentStreak={currentStreak}
        onClose={() => setShowProgress(false)}
      />
    );
  }

  if (showSchedule && displayProgram?.workouts) {
    return (
      <WorkoutSchedule
        workouts={displayProgram.workouts}
        onClose={() => setShowSchedule(false)}
      />
    );
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-2">No workout program yet</p>
      <p className="text-xs text-muted-foreground mb-6 max-w-xs">
        Generate an AI-powered program tailored to your goals, or follow your own routine
      </p>
      
      {!showCustomOption ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button 
            className="gradient-primary w-full" 
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
                Generate AI Program
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowCustomOption(true)}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            I Have My Own Program
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <p className="text-sm text-muted-foreground mb-2">
            Custom workout logging coming soon! For now, generate a program and modify exercises as needed.
          </p>
          <Button 
            className="gradient-primary w-full" 
            onClick={() => {
              setShowCustomOption(false);
              generateProgram();
            }}
            disabled={isGenerating}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Program Instead
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowCustomOption(false)}
          >
            Go Back
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="dark bg-background pb-6">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Workouts</h1>
          <p className="text-muted-foreground">Your training schedule</p>
        </div>

        {/* Streak Card */}
        <div className="mx-6 mb-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{currentStreak} Day Streak</p>
                <p className="text-xs text-muted-foreground">Complete workouts + meals daily</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${workoutDone ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {workoutDone ? '✓' : '○'} Workout
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${mealsDone ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {mealsDone ? '✓' : '○'} Meals
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {program && (
          <div className="mx-6 mb-4 rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Weekly Progress</span>
              <span className="text-sm font-medium text-primary">{completedThisWeek}/{program.workouts.length} workouts</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(completedThisWeek / Math.max(program.workouts.length, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 px-6 mb-6">
          <Button variant="outline" className="flex-1" onClick={() => setShowProgress(true)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Progress
          </Button>
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => setShowSchedule(true)}
            disabled={!displayProgram?.workouts?.length}
          >
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
              <RestDayCard />
            
            ) : (
              <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : program?.workouts && program.workouts.length > 0 ? (
              <>
                {program.workouts
                  .slice()
                  .sort((a, b) => a.day_of_week - b.day_of_week)
                  .map((workout) => {
                    const locked = isWorkoutLocked(workout);
                    const isToday = workout.day_of_week === today;
                    
                    return (
                      <div key={workout.id} className="flex items-center gap-3">
                        <div className={`w-10 text-center ${isToday ? 'text-primary font-bold' : ''}`}>
                          <span className="text-xs font-medium">
                            {dayNames[workout.day_of_week]}
                          </span>
                          {isToday && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto mt-1" />
                          )}
                        </div>
                        <div className="flex-1 relative">
                          <WorkoutCard
                            name={workout.name}
                            type={workout.workout_type}
                            duration={workout.duration_minutes}
                            calories={300}
                            exercises={workout.exercises.length}
                            completed={workout.is_completed}
                            onStart={canStartWorkout(workout) ? () => handleStartWorkout(workout) : undefined}
                          />
                          {locked && (
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Lock className="h-4 w-4" />
                                <span className="text-sm">
                                  {workout.day_of_week < today ? "Missed" : "Upcoming"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </>
            ) : (
              <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : completedWorkouts.length > 0 ? (
              completedWorkouts.map((workout) => (
                <div key={workout.id} className="rounded-xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{workout.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(workout.completed_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {workout.duration_minutes} min
                    </div>
                  </div>
                  
                  {/* Exercise List */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Exercises Completed:</p>
                    {workout.exercises.map((exercise) => (
                      <div key={exercise.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="h-3 w-3 text-primary" />
                          <span className="text-foreground">{exercise.name}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {exercise.sets} × {exercise.reps}
                          {exercise.weight && ` @ ${exercise.weight}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No completed workouts yet</p>
                <p className="text-xs text-muted-foreground mt-1">Complete workouts to see your history</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
