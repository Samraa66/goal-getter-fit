import { Button } from "@/components/ui/button";
import { Trophy, Flame, Clock } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";

interface WorkoutCompleteProps {
  workoutName: string;
  duration: number;
  caloriesBurned: number;
  exercisesCompleted: number;
  onClose: () => void;
}

export function WorkoutComplete({
  workoutName,
  duration,
  caloriesBurned,
  exercisesCompleted,
  onClose,
}: WorkoutCompleteProps) {
  useEffect(() => {
    // Celebrate!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <div className="mb-6 inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/20">
          <Trophy className="h-12 w-12 text-primary" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">
          Workout Complete!
        </h1>
        <p className="text-muted-foreground mb-8">{workoutName}</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{duration}</p>
            <p className="text-xs text-muted-foreground">minutes</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{caloriesBurned}</p>
            <p className="text-xs text-muted-foreground">calories</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{exercisesCompleted}</p>
            <p className="text-xs text-muted-foreground">exercises</p>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full gradient-primary"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
