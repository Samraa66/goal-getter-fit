import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MealCard } from "@/components/meals/MealCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Calendar, Plus, Loader2, Sparkles } from "lucide-react";
import { useMealPlan } from "@/hooks/useMealPlan";
import { addDays } from "date-fns";

const mealTypeOrder = ["breakfast", "lunch", "snack", "dinner"];

export default function Meals() {
  const [activeTab, setActiveTab] = useState("today");
  
  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const { mealPlan, isLoading, isGenerating, generateMealPlan } = useMealPlan(today);
  const { 
    mealPlan: tomorrowPlan, 
    isGenerating: isGeneratingTomorrow, 
    generateMealPlan: generateTomorrowPlan 
  } = useMealPlan(tomorrow);

  const sortedMeals = mealPlan?.meals.slice().sort(
    (a, b) => mealTypeOrder.indexOf(a.meal_type) - mealTypeOrder.indexOf(b.meal_type)
  ) || [];

  const sortedTomorrowMeals = tomorrowPlan?.meals.slice().sort(
    (a, b) => mealTypeOrder.indexOf(a.meal_type) - mealTypeOrder.indexOf(b.meal_type)
  ) || [];

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Meal Plan</h1>
          <p className="text-muted-foreground">Plan your nutrition for the week</p>
        </div>

        {/* Summary Bar */}
        {mealPlan && (
          <div className="mx-6 mb-4 flex items-center justify-between rounded-xl bg-card border border-border p-4">
            <div>
              <p className="text-sm text-muted-foreground">Today's Total</p>
              <p className="text-xl font-bold text-foreground">{mealPlan.total_calories} kcal</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Protein</p>
              <p className="text-xl font-bold text-primary">{mealPlan.total_protein}g</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 px-6 mb-6">
          <Button variant="outline" className="flex-1">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Grocery List
          </Button>
          <Button variant="outline" className="flex-1">
            <Calendar className="mr-2 h-4 w-4" />
            Week View
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex-1">Tomorrow</TabsTrigger>
            <TabsTrigger value="week" className="flex-1">Week</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sortedMeals.length > 0 ? (
              <>
                {sortedMeals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                    name={meal.name}
                    calories={meal.calories}
                    protein={meal.protein}
                    carbs={meal.carbs}
                    fats={meal.fats}
                  />
                ))}
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={generateMealPlan}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Regenerate Plan
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No meal plan for today yet</p>
                <Button 
                  className="gradient-primary" 
                  onClick={generateMealPlan}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Meal Plan
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tomorrow" className="mt-4 space-y-4">
            {sortedTomorrowMeals.length > 0 ? (
              <>
                {sortedTomorrowMeals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                    name={meal.name}
                    calories={meal.calories}
                    protein={meal.protein}
                    carbs={meal.carbs}
                    fats={meal.fats}
                  />
                ))}
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={generateTomorrowPlan}
                  disabled={isGeneratingTomorrow}
                >
                  {isGeneratingTomorrow ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Regenerate Plan
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Tomorrow's meals will be generated</p>
                <Button 
                  className="gradient-primary"
                  onClick={generateTomorrowPlan}
                  disabled={isGeneratingTomorrow}
                >
                  {isGeneratingTomorrow ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Plan
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">View your weekly meal overview</p>
              <Button className="mt-4 gradient-primary">Generate Week Plan</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
