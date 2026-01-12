import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreathingSessionProps {
  onComplete: () => void;
  onClose: () => void;
}

type BreathingPhase = "inhale" | "hold1" | "exhale" | "hold2";

const PHASE_DURATION = 4; // 4 seconds per phase
const TOTAL_CYCLES = 6; // ~3-4 minutes for 6 cycles (16s per cycle = 96s)

const PHASE_CONFIG: Record<BreathingPhase, { label: string; instruction: string }> = {
  inhale: { label: "Inhale", instruction: "Breathe in slowly through your nose" },
  hold1: { label: "Hold", instruction: "Gently hold your breath" },
  exhale: { label: "Exhale", instruction: "Release slowly through your mouth" },
  hold2: { label: "Hold", instruction: "Stay relaxed before the next breath" },
};

const PHASE_ORDER: BreathingPhase[] = ["inhale", "hold1", "exhale", "hold2"];

export function BreathingSession({ onComplete, onClose }: BreathingSessionProps) {
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseTime, setPhaseTime] = useState(PHASE_DURATION);
  const [isComplete, setIsComplete] = useState(false);

  const currentPhase = PHASE_ORDER[phaseIndex];
  const { label, instruction } = PHASE_CONFIG[currentPhase];

  const advancePhase = useCallback(() => {
    if (phaseIndex < PHASE_ORDER.length - 1) {
      setPhaseIndex(prev => prev + 1);
      setPhaseTime(PHASE_DURATION);
    } else {
      // Completed one full cycle
      if (currentCycle < TOTAL_CYCLES) {
        setCurrentCycle(prev => prev + 1);
        setPhaseIndex(0);
        setPhaseTime(PHASE_DURATION);
      } else {
        // All cycles complete
        setIsComplete(true);
      }
    }
  }, [phaseIndex, currentCycle]);

  useEffect(() => {
    if (!isStarted || isPaused || isComplete) return;

    const timer = setInterval(() => {
      setPhaseTime(prev => {
        if (prev <= 1) {
          advancePhase();
          return PHASE_DURATION;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, isPaused, isComplete, advancePhase]);

  // Calculate circle animation scale based on phase
  const getCircleScale = () => {
    const progress = (PHASE_DURATION - phaseTime) / PHASE_DURATION;
    switch (currentPhase) {
      case "inhale":
        return 0.6 + (0.4 * progress); // 0.6 -> 1.0
      case "hold1":
        return 1.0;
      case "exhale":
        return 1.0 - (0.4 * progress); // 1.0 -> 0.6
      case "hold2":
        return 0.6;
      default:
        return 0.8;
    }
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
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/40 flex items-center justify-center">
              <span className="text-2xl">🧘</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Nice work
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xs">
            Your body is shifting into recovery mode. The calm you feel now supports deeper rest.
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
          <h1 className="text-xl font-bold text-foreground">Breathing & Meditation</h1>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-indigo-500/30 flex items-center justify-center">
              <span className="text-4xl">🫁</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3">
            Box Breathing
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xs">
            This breathing pattern helps calm your nervous system and support recovery.
          </p>

          {/* Pattern explanation */}
          <div className="flex items-center gap-3 mb-8 text-sm">
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-secondary">
              <span className="font-semibold text-foreground">4s</span>
              <span className="text-xs text-muted-foreground">Inhale</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-secondary">
              <span className="font-semibold text-foreground">4s</span>
              <span className="text-xs text-muted-foreground">Hold</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-secondary">
              <span className="font-semibold text-foreground">4s</span>
              <span className="text-xs text-muted-foreground">Exhale</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-secondary">
              <span className="font-semibold text-foreground">4s</span>
              <span className="text-xs text-muted-foreground">Hold</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-8">
            ~{Math.ceil((TOTAL_CYCLES * 4 * PHASE_DURATION) / 60)} minutes • {TOTAL_CYCLES} cycles
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
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Box Breathing</h1>
          <p className="text-sm text-muted-foreground">
            Cycle {currentCycle} of {TOTAL_CYCLES}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Animated Breathing Circle */}
        <div className="relative w-64 h-64 flex items-center justify-center mb-8">
          {/* Outer glow */}
          <div 
            className="absolute inset-0 rounded-full bg-indigo-500/10 transition-transform duration-1000 ease-in-out"
            style={{ transform: `scale(${getCircleScale() * 1.2})` }}
          />
          {/* Middle ring */}
          <div 
            className="absolute inset-4 rounded-full bg-indigo-500/20 transition-transform duration-1000 ease-in-out"
            style={{ transform: `scale(${getCircleScale() * 1.1})` }}
          />
          {/* Main circle */}
          <div 
            className="absolute inset-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 transition-transform duration-1000 ease-in-out flex items-center justify-center"
            style={{ transform: `scale(${getCircleScale()})` }}
          >
            <span className="text-5xl font-bold text-foreground">{phaseTime}</span>
          </div>
        </div>

        {/* Phase Label */}
        <h2 className={cn(
          "text-3xl font-bold mb-2 transition-colors",
          currentPhase === "inhale" && "text-indigo-400",
          currentPhase === "hold1" && "text-purple-400",
          currentPhase === "exhale" && "text-teal-400",
          currentPhase === "hold2" && "text-purple-400"
        )}>
          {label}
        </h2>
        <p className="text-muted-foreground text-center max-w-xs">
          {instruction}
        </p>

        {/* Phase Progress Dots */}
        <div className="flex gap-2 mt-8">
          {PHASE_ORDER.map((phase, idx) => (
            <div
              key={phase}
              className={cn(
                "w-3 h-3 rounded-full transition-colors",
                idx === phaseIndex
                  ? "bg-primary"
                  : idx < phaseIndex
                  ? "bg-primary/40"
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
          onClick={onClose}
        >
          End Session
        </Button>
      </div>
    </div>
  );
}
