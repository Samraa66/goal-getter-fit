import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Dumbbell, Leaf, Clock, CheckCircle2 } from "lucide-react";

interface Workout {
  id: string;
  name: string;
  workout_type: string;
  day_of_week: number;
  duration_minutes: number;
  is_completed: boolean;
  exercises: any[];
}

interface WorkoutScheduleProps {
  workouts: Workout[];
  onClose: () => void;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const workoutTypeColors: Record<string, string> = {
  push: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
  pull: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
  legs: "from-green-500/20 to-green-600/20 border-green-500/30",
  upper: "from-orange-500/20 to-orange-600/20 border-orange-500/30",
  lower: "from-teal-500/20 to-teal-600/20 border-teal-500/30",
  full: "from-pink-500/20 to-pink-600/20 border-pink-500/30",
  cardio: "from-red-500/20 to-red-600/20 border-red-500/30",
  rest: "from-muted/50 to-muted/50 border-border",
};

export function WorkoutSchedule({ workouts, onClose }: WorkoutScheduleProps) {
  const today = new Date().getDay();
  
  // Create a full week schedule (0-6 for Sunday-Saturday)
  const weekSchedule = Array.from({ length: 7 }, (_, dayIndex) => {
    const workout = workouts.find(w => w.day_of_week === dayIndex);
    return {
      dayIndex,
      dayName: dayNames[dayIndex],
      shortName: shortDayNames[dayIndex],
      workout,
      isToday: dayIndex === today,
      isRest: !workout,
    };
  });

  // Stats
  const workoutDays = workouts.length;
  const restDays = 7 - workoutDays;
  const completedCount = workouts.filter(w => w.is_completed).length;

  return (
    <div className="dark bg-background min-h-screen pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <Button variant="ghost" size="sm" onClick={onClose} className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          Weekly Schedule
        </h1>
        <p className="text-muted-foreground">Your workout plan at a glance</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Week Overview */}
        <Card className="p-4 bg-card border-border">
          <div className="flex justify-between mb-4">
            {weekSchedule.map((day) => (
              <div 
                key={day.dayIndex} 
                className={`flex flex-col items-center ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <span className="text-xs font-medium mb-2">{day.shortName}</span>
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    day.isToday 
                      ? 'bg-primary text-primary-foreground' 
                      : day.workout 
                        ? day.workout.is_completed 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-secondary text-foreground'
                        : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {day.workout ? (
                    day.workout.is_completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Dumbbell className="h-3 w-3" />
                    )
                  ) : (
                    <Leaf className="h-3 w-3" />
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary" />
              <span className="text-muted-foreground">{workoutDays} Workout Days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted/50" />
              <span className="text-muted-foreground">{restDays} Rest Days</span>
            </div>
          </div>
        </Card>

        {/* This Week Progress */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">This Week's Progress</span>
            <span className="text-sm font-medium text-primary">{completedCount}/{workoutDays} completed</span>
          </div>
          <div className="h-2 rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedCount / Math.max(workoutDays, 1)) * 100}%` }}
            />
          </div>
        </Card>

        {/* Daily Schedule */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Daily Breakdown</h3>
          
          {weekSchedule.map((day) => {
            const colorClass = day.workout 
              ? workoutTypeColors[day.workout.workout_type.toLowerCase()] || workoutTypeColors.full
              : workoutTypeColors.rest;
            
            return (
              <Card 
                key={day.dayIndex}
                className={`p-4 bg-gradient-to-r ${colorClass} relative overflow-hidden ${
                  day.isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                }`}
              >
                {day.isToday && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    Today
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <div className="w-16">
                    <p className="text-sm font-medium text-foreground">{day.shortName}</p>
                    <p className="text-xs text-muted-foreground">{day.dayName}</p>
                  </div>
                  
                  <div className="flex-1">
                    {day.workout ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Dumbbell className="h-4 w-4 text-foreground" />
                          <p className="font-medium text-foreground">{day.workout.name}</p>
                          {day.workout.is_completed && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="capitalize">{day.workout.workout_type}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {day.workout.duration_minutes} min
                          </span>
                          <span>{day.workout.exercises?.length || 0} exercises</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Rest Day</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
