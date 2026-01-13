import { cn } from "@/lib/utils";
import { Dumbbell, Target, Info } from "lucide-react";

interface ExerciseCardProps {
  name: string;
  muscleGroups?: string;
  howTo?: string;
  sets: number;
  reps: string;
  weight?: string;
  notes?: string;
  isCompleted?: boolean;
  isActive?: boolean;
}

export function ExerciseCard({
  name,
  muscleGroups,
  howTo,
  sets,
  reps,
  weight,
  notes,
  isCompleted = false,
  isActive = false,
}: ExerciseCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-all duration-200",
        isActive && "border-primary ring-1 ring-primary/20",
        isCompleted && "border-primary/30 bg-primary/5",
        !isActive && !isCompleted && "border-border"
      )}
    >
      {/* Exercise Name */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className={cn(
          "font-semibold text-foreground",
          isCompleted && "text-muted-foreground line-through"
        )}>
          {name}
        </h3>
        {isCompleted && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Done
          </span>
        )}
      </div>

      {/* Muscle Groups */}
      {muscleGroups && (
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            {muscleGroups}
          </p>
        </div>
      )}

      {/* How To */}
      {howTo && (
        <div className="flex items-start gap-2 mb-3">
          <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80">
            {howTo}
          </p>
        </div>
      )}

      {/* Sets x Reps */}
      <div className="flex items-center gap-4 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {sets} × {reps}
          </span>
        </div>
        {weight && (
          <span className="text-sm text-primary font-medium">
            {weight}
          </span>
        )}
      </div>

      {/* Additional Notes */}
      {notes && !howTo && (
        <p className="text-xs text-muted-foreground mt-2 bg-secondary/30 rounded-lg p-2">
          💡 {notes}
        </p>
      )}
    </div>
  );
}
