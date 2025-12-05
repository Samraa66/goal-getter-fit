import { Clock, Flame, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MealCardProps {
  type: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  time?: string;
  imageUrl?: string;
  onSwap?: () => void;
}

const mealTypeColors = {
  breakfast: "from-orange-500/20 to-yellow-500/20",
  lunch: "from-green-500/20 to-emerald-500/20",
  dinner: "from-blue-500/20 to-purple-500/20",
  snack: "from-pink-500/20 to-rose-500/20",
};

const mealTypeLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function MealCard({
  type,
  name,
  calories,
  protein,
  carbs,
  fats,
  time,
  imageUrl,
  onSwap,
}: MealCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card animate-fade-in">
      <div className={`bg-gradient-to-r ${mealTypeColors[type]} p-4`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {mealTypeLabels[type]}
          </span>
          {time && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {time}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex gap-4">
          {imageUrl && (
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
              <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{name}</h3>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" />
              <span>{calories} kcal</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/50 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Protein</p>
            <p className="text-sm font-medium text-foreground">{protein}g</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Carbs</p>
            <p className="text-sm font-medium text-foreground">{carbs}g</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Fats</p>
            <p className="text-sm font-medium text-foreground">{fats}g</p>
          </div>
        </div>
        
        {onSwap && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={onSwap}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Swap Meal
          </Button>
        )}
      </div>
    </div>
  );
}
