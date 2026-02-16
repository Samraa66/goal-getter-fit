import { useState } from "react";
import { Clock, Flame, RefreshCw, ChevronDown, ChevronUp, ChefHat, Check, Circle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { MealIngredient } from "@/types/templates";

interface MealCardProps {
  id?: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  time?: string;
  imageUrl?: string;
  recipe?: string;
  description?: string;
  ingredients?: MealIngredient[];
  recipeSteps?: string[];
  isCompleted?: boolean;
  onSwap?: () => void;
  onToggleComplete?: (completed: boolean) => void;
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

// Parse recipe into numbered steps (legacy support)
function parseRecipeSteps(recipe: string): string[] {
  const stepPattern = /(?:Step\s*\d+[:.]\s*)/gi;
  let steps = recipe.split(stepPattern).filter((s) => s.trim());
  if (steps.length <= 1) {
    const numberedPattern = /(?:\d+[.)]\s*)/g;
    steps = recipe.split(numberedPattern).filter((s) => s.trim());
  }
  if (steps.length <= 1) {
    steps = recipe
      .split(/\.\s+/)
      .filter((s) => s.trim())
      .map((s) => (s.endsWith(".") ? s : s + "."));
  }
  return steps;
}

export function MealCard({
  id,
  type,
  name,
  calories,
  protein,
  carbs,
  fats,
  time,
  imageUrl,
  recipe,
  description,
  ingredients,
  recipeSteps,
  isCompleted = false,
  onSwap,
  onToggleComplete,
}: MealCardProps) {
  const [showRecipe, setShowRecipe] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const legacyRecipeSteps = recipe ? parseRecipeSteps(recipe) : [];
  const allRecipeSteps = recipeSteps && recipeSteps.length > 0 ? recipeSteps : legacyRecipeSteps;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card animate-fade-in transition-all",
        isCompleted ? "border-primary/50 opacity-75" : "border-border"
      )}
    >
      <div className={`bg-gradient-to-r ${mealTypeColors[type]} p-4`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/70 uppercase tracking-wider">
            {mealTypeLabels[type]}
          </span>
          <div className="flex items-center gap-3">
            {time && (
              <div className="flex items-center gap-1 text-xs text-foreground/70">
                <Clock className="h-3 w-3" />
                {time}
              </div>
            )}
            {onToggleComplete && (
              <button
                onClick={() => onToggleComplete(!isCompleted)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-primary/20"
                )}
              >
                {isCompleted ? (
                  <>
                    <Check className="h-3 w-3" />
                    Done
                  </>
                ) : (
                  <>
                    <Circle className="h-3 w-3" />
                    Mark Done
                  </>
                )}
              </button>
            )}
          </div>
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
            <h3 className={cn("font-semibold text-foreground", isCompleted && "line-through opacity-70")}>
              {name}
            </h3>
            {description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>}
            <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <Flame className="h-4 w-4 text-primary" />
              <span>{calories} kcal</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/50 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Protein</p>
            <p className="text-sm font-bold text-secondary-foreground">{protein}g</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Carbs</p>
            <p className="text-sm font-bold text-foreground">{carbs}g</p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">Fats</p>
            <p className="text-sm font-bold text-foreground">{fats}g</p>
          </div>
        </div>

        {/* Structured Ingredients Section */}
        {ingredients && ingredients.length > 0 && (
          <Collapsible open={showIngredients} onOpenChange={setShowIngredients} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-foreground hover:text-foreground">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  <span>Ingredients ({ingredients.length})</span>
                </div>
                {showIngredients ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg bg-secondary/30 p-3 space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                    <span className="text-foreground">{ing.ingredient_name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground text-xs">
                      <span>{ing.grams}g</span>
                      <span>{ing.calories} kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recipe Section */}
        {allRecipeSteps.length > 0 && (
          <Collapsible open={showRecipe} onOpenChange={setShowRecipe} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-foreground hover:text-foreground">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4" />
                  <span>How to make it</span>
                </div>
                {showRecipe ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg bg-secondary/30 p-4">
                <ol className="space-y-3">
                  {allRecipeSteps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm text-foreground">
                      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step.trim()}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {onSwap && (
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onSwap}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Swap Meal
          </Button>
        )}
      </div>
    </div>
  );
}
