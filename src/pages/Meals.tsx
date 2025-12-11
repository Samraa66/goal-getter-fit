import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MealCard } from "@/components/meals/MealCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Calendar, Plus, Loader2, Sparkles, Edit3 } from "lucide-react";
import { useMealPlan } from "@/hooks/useMealPlan";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const mealTypeOrder = ["breakfast", "lunch", "snack", "dinner"];

export default function Meals() {
  const [activeTab, setActiveTab] = useState("today");
  const [showCustomOption, setShowCustomOption] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [customMeal, setCustomMeal] = useState({
    name: "",
    meal_type: "breakfast",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });
  
  const { user } = useAuth();
  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const { mealPlan, isLoading, isGenerating, generateMealPlan, refetch } = useMealPlan(today);
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

  const handleAddMeal = async () => {
    if (!user || !customMeal.name) return;
    
    setIsAddingMeal(true);
    try {
      // First, ensure we have a meal plan for today
      let planId = mealPlan?.id;
      
      if (!planId) {
        const { data: newPlan, error: planError } = await supabase
          .from("meal_plans")
          .insert({
            user_id: user.id,
            plan_date: today.toISOString().split("T")[0],
            total_calories: 0,
            total_protein: 0,
            total_carbs: 0,
            total_fats: 0,
          })
          .select()
          .single();
        
        if (planError) throw planError;
        planId = newPlan.id;
      }
      
      // Add the meal
      const { error: mealError } = await supabase.from("meals").insert({
        meal_plan_id: planId,
        name: customMeal.name,
        meal_type: customMeal.meal_type,
        calories: parseInt(customMeal.calories) || 0,
        protein: parseInt(customMeal.protein) || 0,
        carbs: parseInt(customMeal.carbs) || 0,
        fats: parseInt(customMeal.fats) || 0,
      });
      
      if (mealError) throw mealError;
      
      toast.success("Meal added successfully!");
      setAddMealOpen(false);
      setShowCustomOption(false);
      setCustomMeal({ name: "", meal_type: "breakfast", calories: "", protein: "", carbs: "", fats: "" });
      refetch();
    } catch (error) {
      console.error("Error adding meal:", error);
      toast.error("Failed to add meal");
    } finally {
      setIsAddingMeal(false);
    }
  };

  const AddMealDialog = () => (
    <Dialog open={addMealOpen} onOpenChange={setAddMealOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add a Meal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Your Meal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Meal Name</Label>
            <Input
              placeholder="e.g., Grilled Chicken Salad"
              value={customMeal.name}
              onChange={(e) => setCustomMeal({ ...customMeal, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Meal Type</Label>
            <Select
              value={customMeal.meal_type}
              onValueChange={(value) => setCustomMeal({ ...customMeal, meal_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Calories</Label>
              <Input
                type="number"
                placeholder="kcal"
                value={customMeal.calories}
                onChange={(e) => setCustomMeal({ ...customMeal, calories: e.target.value })}
              />
            </div>
            <div>
              <Label>Protein (g)</Label>
              <Input
                type="number"
                placeholder="g"
                value={customMeal.protein}
                onChange={(e) => setCustomMeal({ ...customMeal, protein: e.target.value })}
              />
            </div>
            <div>
              <Label>Carbs (g)</Label>
              <Input
                type="number"
                placeholder="g"
                value={customMeal.carbs}
                onChange={(e) => setCustomMeal({ ...customMeal, carbs: e.target.value })}
              />
            </div>
            <div>
              <Label>Fats (g)</Label>
              <Input
                type="number"
                placeholder="g"
                value={customMeal.fats}
                onChange={(e) => setCustomMeal({ ...customMeal, fats: e.target.value })}
              />
            </div>
          </div>
          <Button 
            className="w-full gradient-primary" 
            onClick={handleAddMeal}
            disabled={!customMeal.name || isAddingMeal}
          >
            {isAddingMeal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Meal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const EmptyState = ({ onGenerate, isGeneratingPlan, showOptions = true }: { 
    onGenerate: () => void; 
    isGeneratingPlan: boolean;
    showOptions?: boolean;
  }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-2">No meal plan yet</p>
      <p className="text-xs text-muted-foreground mb-6 max-w-xs">
        Generate an AI-powered plan tailored to your goals, or add your own meals
      </p>
      
      {showOptions && !showCustomOption ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button 
            className="gradient-primary w-full" 
            onClick={onGenerate}
            disabled={isGeneratingPlan}
          >
            {isGeneratingPlan ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Meal Plan
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowCustomOption(true)}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            I Have My Own Plan
          </Button>
        </div>
      ) : showCustomOption ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <AddMealDialog />
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowCustomOption(false)}
          >
            Go Back
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <AppLayout>
      <div className="dark bg-background pb-6">
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
                    recipe={meal.recipe}
                    description={meal.description}
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
              <EmptyState onGenerate={generateMealPlan} isGeneratingPlan={isGenerating} />
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
                    recipe={meal.recipe}
                    description={meal.description}
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
              <EmptyState onGenerate={generateTomorrowPlan} isGeneratingPlan={isGeneratingTomorrow} />
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
