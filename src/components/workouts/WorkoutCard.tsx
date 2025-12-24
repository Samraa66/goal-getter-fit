import { Clock, Flame, Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkoutCardProps {
  name: string;
  type: string;
  duration: number;
  calories: number;
  exercises: number;
  completed?: boolean;
  onStart?: () => void;
}

const workoutTypeStyles: Record<string, { gradient: string; badge: string; label: string }> = {
  strength: {
    gradient: "from-orange-500/20 to-red-500/20",
    badge: "bg-orange-500/20 text-orange-400",
    label: "Strength",
  },
  cardio: {
    gradient: "from-blue-500/20 to-cyan-500/20",
    badge: "bg-blue-500/20 text-blue-400",
    label: "Cardio",
  },
  flexibility: {
    gradient: "from-purple-500/20 to-pink-500/20",
    badge: "bg-purple-500/20 text-purple-400",
    label: "Flexibility",
  },
  push: {
    gradient: "from-orange-500/20 to-amber-500/20",
    badge: "bg-orange-500/20 text-orange-400",
    label: "Push",
  },
  pull: {
    gradient: "from-blue-500/20 to-indigo-500/20",
    badge: "bg-blue-500/20 text-blue-400",
    label: "Pull",
  },
  legs: {
    gradient: "from-green-500/20 to-emerald-500/20",
    badge: "bg-green-500/20 text-green-400",
    label: "Legs",
  },
  rest: {
    gradient: "from-gray-500/20 to-slate-500/20",
    badge: "bg-gray-500/20 text-gray-400",
    label: "Rest",
  },
  upper: {
    gradient: "from-red-500/20 to-orange-500/20",
    badge: "bg-red-500/20 text-red-400",
    label: "Upper Body",
  },
  lower: {
    gradient: "from-teal-500/20 to-green-500/20",
    badge: "bg-teal-500/20 text-teal-400",
    label: "Lower Body",
  },
  full_body: {
    gradient: "from-purple-500/20 to-violet-500/20",
    badge: "bg-purple-500/20 text-purple-400",
    label: "Full Body",
  },
};

const defaultStyle = {
  gradient: "from-primary/20 to-accent/20",
  badge: "bg-primary/20 text-primary",
  label: "Workout",
};

export function WorkoutCard({
  name,
  type,
  duration,
  calories,
  exercises,
  completed = false,
  onStart,
}: WorkoutCardProps) {
  const normalizedType = type?.toLowerCase().replace(/[\s-]+/g, "_") || "";
  const style = workoutTypeStyles[normalizedType] || defaultStyle;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card animate-fade-in",
        completed ? "border-primary/30" : "border-border"
      )}
    >
      <div className={`bg-gradient-to-r ${style.gradient} p-4`}>
        <div className="flex items-center justify-between">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>
            {style.label}
          </span>
          {completed && (
            <CheckCircle className="h-5 w-5 text-primary" />
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-foreground">{name}</h3>

        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{duration} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4" />
            <span>{calories} kcal</span>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {exercises} exercises
        </p>

        {!completed && onStart && (
          <Button className="mt-4 w-full gradient-primary" onClick={onStart}>
            <Play className="mr-2 h-4 w-4" />
            Start Workout
          </Button>
        )}
      </div>
    </div>
  );
}
