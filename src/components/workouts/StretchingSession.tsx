import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, SkipForward, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface StretchingSessionProps {
  onComplete: () => void;
  onClose: () => void;
}

interface Stretch {
  id: string;
  name: string;
  duration: number;
  instruction: string;
  emoji: string;
}

const STRETCHES: Stretch[] = [
  {
    id: "neck",
    name: "Neck Mobility",
    duration: 30,
    instruction: "Slowly roll your head in circles, then side to side. Release tension from your neck and shoulders.",
    emoji: "🦒",
  },
  {
    id: "shoulders",
    name: "Shoulder Rolls",
    duration: 30,
    instruction: "Roll your shoulders forward, then backward. Open up your chest and release upper back tension.",
    emoji: "💪",
  },
  {
    id: "hip-opener",
    name: "Hip Opener",
    duration: 45,
    instruction: "In a seated or standing position, gently open your hips with a figure-four stretch. Hold each side.",
    emoji: "🧘",
  },
  {
    id: "hamstring",
    name: "Hamstring Stretch",
    duration: 45,
    instruction: "Reach toward your toes with a straight back. Feel the stretch along the back of your legs.",
    emoji: "🦵",
  },
  {
    id: "quad",
    name: "Quad Stretch",
    duration: 40,
    instruction: "Standing or lying down, pull one foot toward your glutes. Hold each leg for 20 seconds.",
    emoji: "🏃",
  },
  {
    id: "spine-twist",
    name: "Spine Twist",
    duration: 40,
    instruction: "Lying on your back, drop both knees to one side while keeping shoulders flat. Switch sides.",
    emoji: "🔄",
  },
];

export function StretchingSession({ onComplete, onClose }: StretchingSessionProps) {
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStretchIndex, setCurrentStretchIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(STRETCHES[0].duration);
  const [isComplete, setIsComplete] = useState(false);

  const currentStretch = STRETCHES[currentStretchIndex];
  const totalDuration = STRETCHES.reduce((acc, s) => acc + s.duration, 0);
  const completedDuration = STRETCHES.slice(0, currentStretchIndex).reduce((acc, s) => acc + s.duration, 0);
  const overallProgress = ((completedDuration + (currentStretch.duration - timeRemaining)) / totalDuration) * 100;

  const advanceStretch = useCallback(() => {
    if (currentStretchIndex < STRETCHES.length - 1) {
      const nextIndex = currentStretchIndex + 1;
      setCurrentStretchIndex(nextIndex);
      setTimeRemaining(STRETCHES[nextIndex].duration);
    } else {
      setIsComplete(true);
    }
  }, [currentStretchIndex]);

  useEffect(() => {
    if (!isStarted || isPaused || isComplete) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          advanceStretch();
          return currentStretchIndex < STRETCHES.length - 1 
            ? STRETCHES[currentStretchIndex + 1].duration 
            : 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, isPaused, isComplete, advanceStretch, currentStretchIndex]);

  const handleSkipStretch = () => {
    advanceStretch();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
  };

  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="px-6 pt-12 pb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Session Complete</h1>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/40 flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Mobility complete
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xs">
            Your muscles are ready to recover. This routine helps reduce stiffness and improve flexibility over time.
          </p>

          <Button 
            size="lg" 
            className="gradient-primary px-8"
            onClick={onComplete}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="px-6 pt-12 pb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Light Mobility</h1>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <span className="text-4xl">🌿</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3">
            Gentle Stretching Routine
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xs">
            A guided sequence of light stretches to reduce stiffness and support recovery.
          </p>

          {/* Stretch preview */}
          <div className="w-full max-w-sm mb-8">
            <div className="flex flex-wrap justify-center gap-2">
              {STRETCHES.map((stretch) => (
                <span 
                  key={stretch.id}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary text-muted-foreground"
                >
                  {stretch.emoji} {stretch.name}
                </span>
              ))}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-8">
            ~{Math.ceil(totalDuration / 60)} minutes • {STRETCHES.length} stretches
          </div>

          <Button 
            size="lg" 
            className="gradient-primary px-8"
            onClick={() => setIsStarted(true)}
          >
            Start Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Light Mobility</h1>
            <p className="text-sm text-muted-foreground">
              Stretch {currentStretchIndex + 1} of {STRETCHES.length}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Stretch Emoji */}
        <div className="w-28 h-28 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
          <span className="text-5xl">{currentStretch.emoji}</span>
        </div>

        {/* Stretch Name */}
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {currentStretch.name}
        </h2>

        {/* Timer */}
        <div className="text-5xl font-bold text-primary mb-4">
          {formatTime(timeRemaining)}
        </div>

        {/* Instruction */}
        <p className="text-muted-foreground max-w-sm mb-8">
          {currentStretch.instruction}
        </p>

        {/* Progress Indicators */}
        <div className="flex gap-2 mb-4">
          {STRETCHES.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                idx === currentStretchIndex
                  ? "bg-primary w-6"
                  : idx < currentStretchIndex
                  ? "bg-primary/60"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="px-6 py-6 flex justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={() => setIsPaused(!isPaused)}
        >
          {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          <span className="ml-2">{isPaused ? "Resume" : "Pause"}</span>
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={handleSkipStretch}
        >
          <SkipForward className="h-5 w-5 mr-2" />
          Skip
        </Button>
      </div>
    </div>
  );
}
