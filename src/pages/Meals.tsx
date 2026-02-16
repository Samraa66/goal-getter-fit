import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { MealCard } from "@/components/meals/MealCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles } from "lucide-react";
import { useTemplateMeals } from "@/hooks/useTemplateMeals";
import { usePlanRefresh } from "@/hooks/usePlanRefresh";
import { addDays } from "date-fns";
import type { MealStructure } from "@/types/templates";

const mealTypeOrder = ["breakfast", "lunch", "snack", "dinner"];

export default function Meals() {
  const [activeTab, setActiveTab] = useState("today");

  const today = new Date();
  const tomorrow = addDays(today, 1);

  const {
    userMeals,
    isLoading,
    isGenerating,
    generatePlan,
    toggleComplete,
    refetch,
    totalCalories,
    totalProtein,
    consumedCalories,
    consumedProtein,
  } = useTemplateMeals(today);

  const {
    userMeals: tomorrowMeals,
    isGenerating: isGeneratingTomorrow,
    generatePlan: generateTomorrowPlan,
    toggleComplete: toggleTomorrowComplete,
  } = useTemplateMeals(tomorrow);

  // Listen for refresh events from Coach AI
  const handleMealsRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  usePlanRefresh(handleMealsRefresh, undefined);

  const sortedMeals = [...userMeals].sort(
    (a, b) => mealTypeOrder.indexOf(a.meal_type) - mealTypeOrder.indexOf(b.meal_type)
  );
  const sortedTomorrowMeals = [...tomorrowMeals].sort(
    (a, b) => mealTypeOrder.indexOf(a.meal_type) - mealTypeOrder.indexOf(b.meal_type)
  );

  const getMealData = (personalizedData: MealStructure) => {
    return {
      name: personalizedData?.meal_name || "Meal",
      ingredients: personalizedData?.ingredients || [],
    };
  };

  const EmptyState = ({
    onGenerate,
    isGeneratingPlan,
  }: {
    onGenerate: () => void;
    isGeneratingPlan: boolean;
  }) => (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-150" />
        <div className="relative rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-6 border border-primary/20">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No meal plan yet</h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-[280px] leading-relaxed">
        Generate a plan tailored to your goals from our curated templates.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          className="gradient-primary w-full h-12 text-base font-medium shadow-lg shadow-primary/25"
          onClick={onGenerate}
          disabled={isGeneratingPlan}
        >
          {isGeneratingPlan ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Meal Plan
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          You can regenerate anytime.
        </p>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <PageContainer>
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Meal Plan</h1>
          <p className="text-muted-foreground">Plan your nutrition for the week</p>
        </div>

        {/* Summary Bar */}
        {userMeals.length > 0 && (
          <div className="mx-6 mb-4 rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground">Consumed / Planned</p>
                <p className="text-xl font-bold text-primary">
                  <span className="text-primary">{consumedCalories}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  {totalCalories} kcal
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Protein</p>
                <p className="text-xl font-bold text-primary">
                  <span className="text-primary">{consumedProtein}g</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  {totalProtein}g
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Mark meals as done to track your intake</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex-1">Tomorrow</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sortedMeals.length > 0 ? (
              <>
                {sortedMeals.map((meal) => {
                  const data = getMealData(meal.personalized_data);
                  return (
                    <MealCard
                      key={meal.id}
                      id={meal.id}
                      type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                      name={data.name}
                      calories={meal.total_calories || 0}
                      protein={meal.total_protein || 0}
                      carbs={meal.total_carbs || 0}
                      fats={meal.total_fats || 0}
                      ingredients={data.ingredients}
                      isCompleted={meal.is_completed}
                      onToggleComplete={(completed) => toggleComplete(meal.id, completed)}
                    />
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={generatePlan}
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
              <EmptyState onGenerate={generatePlan} isGeneratingPlan={isGenerating} />
            )}
          </TabsContent>

          <TabsContent value="tomorrow" className="mt-4 space-y-4">
            {sortedTomorrowMeals.length > 0 ? (
              <>
                {sortedTomorrowMeals.map((meal) => {
                  const data = getMealData(meal.personalized_data);
                  return (
                    <MealCard
                      key={meal.id}
                      id={meal.id}
                      type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                      name={data.name}
                      calories={meal.total_calories || 0}
                      protein={meal.total_protein || 0}
                      carbs={meal.total_carbs || 0}
                      fats={meal.total_fats || 0}
                      ingredients={data.ingredients}
                      isCompleted={meal.is_completed}
                      onToggleComplete={(completed) => toggleTomorrowComplete(meal.id, completed)}
                    />
                  );
                })}
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
              <EmptyState onGenerate={generateTomorrowPlan} isGeneratingPlan={isGeneratingTomorrow} />
            )}
          </TabsContent>
        </Tabs>

        <div className="h-6" />
      </PageContainer>
    </AppLayout>
  );
}
