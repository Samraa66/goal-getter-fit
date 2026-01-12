import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Leaf, 
  Brain, 
  Check, 
  Timer, 
  ArrowRight,
  Sparkles,
  X,
  Footprints,
  Bike,
  Waves,
  Activity,
  HeartPulse
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuidedRecoveryDayProps {
  onActivityLogged?: (activity: { sport: string; duration: number }) => void;
}

type RecoveryStep = "intro" | "stretching" | "breathing" | "activity" | "complete";

const QUICK_ACTIVITIES = [
  { icon: Footprints, label: "Walking", value: "walking" },
  { icon: Bike, label: "Cycling", value: "cycling" },
  { icon: Waves, label: "Swimming", value: "swimming" },
  { icon: Activity, label: "Sports", value: "sports" },
  { icon: HeartPulse, label: "Yoga", value: "yoga" },
];

export function GuidedRecoveryDay({ onActivityLogged }: GuidedRecoveryDayProps) {
  const [currentStep, setCurrentStep] = useState<RecoveryStep>("intro");
  const [skippedAll, setSkippedAll] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  
  // Activity logging state
  const [didActivity, setDidActivity] = useState<boolean | null>(null);
  const [selectedSport, setSelectedSport] = useState("");
  const [customSport, setCustomSport] = useState("");
  const [duration, setDuration] = useState("");

  const handleStartRecovery = () => {
    setCurrentStep("stretching");
  };

  const handleSkipAll = () => {
    setSkippedAll(true);
    setCurrentStep("complete");
  };

  const handleStepComplete = (step: string) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    advanceToNextStep(step as RecoveryStep);
  };

  const handleStepSkip = (step: RecoveryStep) => {
    advanceToNextStep(step);
  };

  const advanceToNextStep = (currentStepValue: RecoveryStep) => {
    const stepOrder: RecoveryStep[] = ["stretching", "breathing", "activity", "complete"];
    const currentIndex = stepOrder.indexOf(currentStepValue);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleLogActivity = () => {
    const sport = selectedSport === "other" ? customSport : selectedSport;
    if (sport && duration) {
      onActivityLogged?.({ sport, duration: parseInt(duration) });
    }
    handleStepComplete("activity");
  };

  const handleNoActivity = () => {
    handleStepComplete("activity");
  };

  // Intro State - Coach Entry Point
  if (currentStep === "intro") {
    return (
      <div className="space-y-6">
        {/* Recovery Day Header */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 shrink-0">
                <Leaf className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Recovery Day</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Today is a recovery day. I'll guide you through a short routine to help your body recover. You can skip anything.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coach Avatar + Message */}
        <div className="flex items-start gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="bg-card border border-border rounded-2xl rounded-tl-md p-4 flex-1">
            <p className="text-sm text-foreground">
              Recovery is part of training, not the absence of it. Ready to take care of your body today?
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3 px-2">
          <Button 
            className="w-full h-12 text-base font-medium gradient-primary"
            onClick={handleStartRecovery}
          >
            Start Recovery
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleSkipAll}
          >
            Skip for today
          </Button>
        </div>
      </div>
    );
  }

  // Complete State
  if (currentStep === "complete") {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <CardContent className="p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {skippedAll ? "Rest day noted" : "Recovery complete"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {skippedAll 
                ? "No worries — rest days don't break your streak. See you tomorrow!"
                : "Rest days help you come back stronger. See you tomorrow!"
              }
            </p>
            
            {completedSteps.size > 0 && (
              <div className="mt-4 flex justify-center gap-2">
                {completedSteps.has("stretching") && (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary">
                    Stretching ✓
                  </span>
                )}
                {completedSteps.has("breathing") && (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary">
                    Breathing ✓
                  </span>
                )}
                {completedSteps.has("activity") && didActivity && (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary">
                    Activity ✓
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coach Message */}
        <div className="flex items-start gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="bg-card border border-border rounded-2xl rounded-tl-md p-4 flex-1">
            <p className="text-sm text-foreground">
              Great job taking care of yourself today. Recovery is when your body adapts and grows stronger. 💪
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Stretching
  if (currentStep === "stretching") {
    return (
      <StepCard
        icon={<Leaf className="h-6 w-6 text-emerald-500" />}
        iconBg="bg-emerald-500/20"
        step="1 of 3"
        title="Mobility & Stretching"
        description="5–8 minutes of light stretching to reduce stiffness and improve flexibility."
        primaryAction="Start Stretching"
        onPrimaryAction={() => handleStepComplete("stretching")}
        onSkip={() => handleStepSkip("stretching")}
      />
    );
  }

  // Step 2: Breathing/Meditation
  if (currentStep === "breathing") {
    return (
      <StepCard
        icon={<Brain className="h-6 w-6 text-indigo-400" />}
        iconBg="bg-indigo-500/20"
        step="2 of 3"
        title="Breathing & Meditation"
        description="3–5 minutes to calm your nervous system and reduce stress."
        primaryAction="Start Breathing"
        onPrimaryAction={() => handleStepComplete("breathing")}
        onSkip={() => handleStepSkip("breathing")}
      />
    );
  }

  // Step 3: Optional Activity
  if (currentStep === "activity") {
    return (
      <div className="space-y-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-muted-foreground font-medium">Step 3 of 3</span>
            </div>
            
            <h3 className="text-lg font-semibold text-foreground mb-2">Light Activity</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Did you do any light activity today?
            </p>

            {didActivity === null ? (
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setDidActivity(true)}
                >
                  Yes, log it
                </Button>
                <Button 
                  variant="ghost" 
                  className="flex-1 text-muted-foreground"
                  onClick={() => {
                    setDidActivity(false);
                    handleNoActivity();
                  }}
                >
                  No, continue
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quick Select */}
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIVITIES.map(({ icon: Icon, label, value }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedSport(value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-colors",
                        selectedSport === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedSport("other")}
                    className={cn(
                      "px-3 py-2 rounded-full text-sm transition-colors",
                      selectedSport === "other"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    )}
                  >
                    Other...
                  </button>
                </div>

                {/* Custom Input */}
                {selectedSport === "other" && (
                  <Input
                    placeholder="Activity name"
                    value={customSport}
                    onChange={(e) => setCustomSport(e.target.value)}
                    className="h-10"
                  />
                )}

                {/* Duration */}
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Duration (minutes)"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-10 flex-1"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="ghost" 
                    className="flex-1"
                    onClick={() => setDidActivity(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 gradient-primary"
                    onClick={handleLogActivity}
                    disabled={!selectedSport || (selectedSport === "other" && !customSport)}
                  >
                    Log Activity
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

// Reusable Step Card Component
interface StepCardProps {
  icon: React.ReactNode;
  iconBg: string;
  step: string;
  title: string;
  description: string;
  primaryAction: string;
  onPrimaryAction: () => void;
  onSkip: () => void;
}

function StepCard({ 
  icon, 
  iconBg, 
  step, 
  title, 
  description, 
  primaryAction, 
  onPrimaryAction, 
  onSkip 
}: StepCardProps) {
  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground font-medium">{step}</span>
          </div>
          
          <div className="flex items-start gap-4 mb-5">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-full shrink-0", iconBg)}>
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              className="flex-1 gradient-primary"
              onClick={onPrimaryAction}
            >
              {primaryAction}
            </Button>
            <Button 
              variant="ghost" 
              className="text-muted-foreground"
              onClick={onSkip}
            >
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
