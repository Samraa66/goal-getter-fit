import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Play, Pause, SkipForward, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  rest_seconds: number;
  notes?: string;
  is_completed?: boolean;
}

interface ActiveWorkoutProps {
  workoutName: string;
  exercises: Exercise[];
  onComplete: () => void;
  onClose: () => void;
  onExerciseComplete: (exerciseId: string) => void;
  onSwapExercise?: (exerciseId: string, reason: string) => Promise<Exercise | null>;
}

export function ActiveWorkout({
  workoutName,
  exercises: initialExercises,
  onComplete,
  onClose,
  onExerciseComplete,
  onSwapExercise,
}: ActiveWorkoutProps) {
  const [exercises, setExercises] = useState(initialExercises);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const currentExercise = exercises[currentExerciseIndex];
  const totalExercises = exercises.length;
  const progress = ((currentExerciseIndex / totalExercises) * 100);

  useEffect(() => {
    let timer: number;
    if (isResting && !isPaused && restTime > 0) {
      timer = window.setInterval(() => {
        setRestTime((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isResting, isPaused, restTime]);

  const handleCompleteSet = () => {
    if (currentSet < currentExercise.sets) {
      setCurrentSet((prev) => prev + 1);
      setRestTime(currentExercise.rest_seconds);
      setIsResting(true);
    } else {
      // Exercise complete
      onExerciseComplete(currentExercise.id);
      
      if (currentExerciseIndex < totalExercises - 1) {
        setCurrentExerciseIndex((prev) => prev + 1);
        setCurrentSet(1);
        setRestTime(currentExercise.rest_seconds);
        setIsResting(true);
      } else {
        // Workout complete!
        onComplete();
      }
    }
  };

  const handleSkipRest = () => {
    setIsResting(false);
    setRestTime(0);
  };

  const handleCantDoExercise = async () => {
    if (!onSwapExercise || isSwapping) return;
    
    setIsSwapping(true);
    try {
      const newExercise = await onSwapExercise(currentExercise.id, "too_hard");
      if (newExercise) {
        setExercises(prev => 
          prev.map((ex, i) => i === currentExerciseIndex ? newExercise : ex)
        );
        setCurrentSet(1);
      }
    } finally {
      setIsSwapping(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentExercise) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">{workoutName}</h1>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          Exercise {currentExerciseIndex + 1} of {totalExercises}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {isResting ? (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Rest Time</p>
            <div className="text-7xl font-bold text-primary mb-8">
              {formatTime(restTime)}
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button size="lg" onClick={handleSkipRest}>
                <SkipForward className="mr-2 h-5 w-5" />
                Skip Rest
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                {currentExercise.name}
              </h2>
              <div className="flex items-center justify-center gap-4 text-lg text-muted-foreground">
                <span>{currentExercise.sets} sets</span>
                <span>×</span>
                <span>{currentExercise.reps} reps</span>
              </div>
              {currentExercise.weight && (
                <p className="text-primary mt-2">{currentExercise.weight}</p>
              )}
              {currentExercise.notes && (
                <p className="text-sm text-muted-foreground mt-4 bg-secondary/50 rounded-lg p-3">
                  💡 {currentExercise.notes}
                </p>
              )}
            </div>

            {/* Set Progress */}
            <div className="flex justify-center gap-2 mb-8">
              {Array.from({ length: currentExercise.sets }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium border-2",
                    i < currentSet - 1
                      ? "bg-primary border-primary text-primary-foreground"
                      : i === currentSet - 1
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {i < currentSet - 1 ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    i + 1
                  )}
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full gradient-primary text-lg py-6"
              onClick={handleCompleteSet}
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              Complete Set {currentSet}
            </Button>

            {onSwapExercise && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-muted-foreground hover:text-foreground"
                onClick={handleCantDoExercise}
                disabled={isSwapping}
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding alternative...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Can't do this? Try an alternative
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-center text-sm text-muted-foreground">
          {isResting ? "Get ready for the next set!" : "Complete all sets to move on"}
        </p>
      </div>
    </div>
  );
}
