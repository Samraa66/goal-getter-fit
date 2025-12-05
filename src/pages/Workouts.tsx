import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Plus } from "lucide-react";

const mockWorkouts = {
  today: [
    { name: "Upper Body Strength", type: "strength" as const, duration: 45, calories: 300, exercises: 8, completed: false },
  ],
  week: [
    { day: "Mon", name: "Upper Body Strength", type: "strength" as const, duration: 45, calories: 300, exercises: 8, completed: true },
    { day: "Tue", name: "HIIT Cardio", type: "cardio" as const, duration: 30, calories: 400, exercises: 6, completed: true },
    { day: "Wed", name: "Lower Body Strength", type: "strength" as const, duration: 50, calories: 350, exercises: 9, completed: true },
    { day: "Thu", name: "Rest & Mobility", type: "flexibility" as const, duration: 20, calories: 100, exercises: 10, completed: false },
    { day: "Fri", name: "Full Body Circuit", type: "strength" as const, duration: 40, calories: 350, exercises: 10, completed: false },
    { day: "Sat", name: "Steady State Cardio", type: "cardio" as const, duration: 45, calories: 300, exercises: 1, completed: false },
    { day: "Sun", name: "Active Recovery", type: "flexibility" as const, duration: 30, calories: 150, exercises: 8, completed: false },
  ],
};

export default function Workouts() {
  const [activeTab, setActiveTab] = useState("today");

  const completedThisWeek = mockWorkouts.week.filter(w => w.completed).length;

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Workouts</h1>
          <p className="text-muted-foreground">Your training schedule</p>
        </div>

        {/* Progress Bar */}
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
            {mockWorkouts.today.map((workout, index) => (
              <WorkoutCard
                key={index}
                {...workout}
                onStart={() => console.log("Start workout:", workout.name)}
              />
            ))}
            <Button variant="outline" className="w-full border-dashed">
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Workout
            </Button>
          </TabsContent>

          <TabsContent value="week" className="mt-4 space-y-4">
            {mockWorkouts.week.map((workout, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-10 text-center">
                  <span className="text-xs font-medium text-muted-foreground">{workout.day}</span>
                </div>
                <div className="flex-1">
                  <WorkoutCard
                    name={workout.name}
                    type={workout.type}
                    duration={workout.duration}
                    calories={workout.calories}
                    exercises={workout.exercises}
                    completed={workout.completed}
                    onStart={workout.completed ? undefined : () => console.log("Start:", workout.name)}
                  />
                </div>
              </div>
            ))}
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
