import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Dumbbell, Calendar, Flame, ArrowLeft, Trophy, Target, Zap } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";

interface CompletedWorkout {
  id: string;
  name: string;
  workout_type: string;
  duration_minutes: number;
  completed_at: string;
  exercises: { id: string; name: string; sets: number; reps: string; weight?: string }[];
}

interface WorkoutProgressProps {
  completedWorkouts: CompletedWorkout[];
  currentStreak: number;
  onClose: () => void;
}

export function WorkoutProgress({ completedWorkouts, currentStreak, onClose }: WorkoutProgressProps) {
  const stats = useMemo(() => {
    const now = new Date();
    
    // Get workouts per week for the last 4 weeks
    const weeklyData = Array.from({ length: 4 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      
      const workoutsInWeek = completedWorkouts.filter(w => 
        isWithinInterval(new Date(w.completed_at), { start: weekStart, end: weekEnd })
      );
      
      return {
        week: i === 0 ? "This Week" : i === 1 ? "Last Week" : `${i} weeks ago`,
        count: workoutsInWeek.length,
        totalDuration: workoutsInWeek.reduce((sum, w) => sum + w.duration_minutes, 0),
      };
    }).reverse();

    // Total stats
    const totalWorkouts = completedWorkouts.length;
    const totalDuration = completedWorkouts.reduce((sum, w) => sum + w.duration_minutes, 0);
    const totalExercises = completedWorkouts.reduce((sum, w) => sum + w.exercises.length, 0);

    // Workout type distribution
    const typeDistribution = completedWorkouts.reduce((acc, w) => {
      const type = w.workout_type.toLowerCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Average workouts per week
    const avgPerWeek = totalWorkouts > 0 
      ? (weeklyData.reduce((sum, w) => sum + w.count, 0) / 4).toFixed(1)
      : "0";

    return { weeklyData, totalWorkouts, totalDuration, totalExercises, typeDistribution, avgPerWeek };
  }, [completedWorkouts]);

  const maxWeekCount = Math.max(...stats.weeklyData.map(w => w.count), 1);

  return (
    <div className="dark bg-background min-h-screen pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <Button variant="ghost" size="sm" onClick={onClose} className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Progress
        </h1>
        <p className="text-muted-foreground">Your workout trends and history</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Streak & Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-xs text-muted-foreground">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{currentStreak} days</p>
          </Card>
          
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Avg/Week</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.avgPerWeek}</p>
          </Card>
        </div>

        {/* Total Stats */}
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">All Time Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{stats.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </div>
            <div>
              <div className="flex items-center justify-center mb-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{stats.totalExercises}</p>
              <p className="text-xs text-muted-foreground">Exercises</p>
            </div>
            <div>
              <div className="flex items-center justify-center mb-2">
                <Dumbbell className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{Math.round(stats.totalDuration / 60)}h</p>
              <p className="text-xs text-muted-foreground">Total Time</p>
            </div>
          </div>
        </Card>

        {/* Weekly Chart */}
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Workouts Per Week</h3>
          <div className="space-y-3">
            {stats.weeklyData.map((week, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 shrink-0">{week.week}</span>
                <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max((week.count / maxWeekCount) * 100, 10)}%` }}
                  >
                    {week.count > 0 && (
                      <span className="text-xs font-medium text-primary-foreground">{week.count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Workout Type Distribution */}
        {Object.keys(stats.typeDistribution).length > 0 && (
          <Card className="p-4 bg-card border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Workout Types</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.typeDistribution).map(([type, count]) => (
                <div key={type} className="px-3 py-2 rounded-lg bg-secondary">
                  <span className="text-sm font-medium text-foreground capitalize">{type}</span>
                  <span className="text-xs text-muted-foreground ml-2">×{count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Activity */}
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Activity</h3>
          {completedWorkouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No workouts completed yet. Start training to see your progress!
            </p>
          ) : (
            <div className="space-y-3">
              {completedWorkouts.slice(0, 5).map((workout) => (
                <div key={workout.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Dumbbell className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{workout.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(workout.completed_at), "MMM d")} • {workout.duration_minutes} min • {workout.exercises.length} exercises
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
