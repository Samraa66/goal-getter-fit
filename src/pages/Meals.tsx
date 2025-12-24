import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MealCard } from "@/components/meals/MealCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Calendar, Plus, Loader2, Sparkles, Edit3, Check } from "lucide-react";
import { useMealPlan } from "@/hooks/useMealPlan";
import { useWeeklyMealPlans } from "@/hooks/useWeeklyMealPlans";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const mealTypeOrder = ["breakfast", "lunch", "snack", "dinner"];

interface GroceryItem {
  name: string;
  quantity: string;
  estimatedPrice?: number;
}

interface GroceryCategory {
  name: string;
  items: GroceryItem[];
}

interface GroceryList {
  categories: GroceryCategory[];
  totalEstimatedCost: number;
  shoppingTips: string[];
}

export default function Meals() {
  const [activeTab, setActiveTab] = useState("today");
  const [showCustomOption, setShowCustomOption] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [isGeneratingGrocery, setIsGeneratingGrocery] = useState(false);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
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
  
  const { mealPlan, isLoading, isGenerating, generateMealPlan, toggleMealComplete, refetch } = useMealPlan(today);
  const { 
    mealPlan: tomorrowPlan, 
    isGenerating: isGeneratingTomorrow, 
    generateMealPlan: generateTomorrowPlan,
    toggleMealComplete: toggleTomorrowComplete,
  } = useMealPlan(tomorrow);
  
  const { weekPlans, allMeals, isLoading: isLoadingWeek } = useWeeklyMealPlans();
  
  // Calculate consumed vs planned based on completed meals
  const completedMeals = mealPlan?.meals.filter(m => m.is_completed) || [];
  const consumedCalories = completedMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const consumedProtein = completedMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

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

  const handleGenerateGroceryList = async () => {
    if (allMeals.length === 0) {
      toast.error("Generate meal plans first to create a grocery list");
      return;
    }

    setIsGeneratingGrocery(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_food_budget, dietary_preference, allergies")
        .eq("id", user?.id)
        .single();

      const response = await supabase.functions.invoke("generate-grocery-list", {
        body: { meals: allMeals, profile },
      });

      if (response.error) throw new Error(response.error.message);

      setGroceryList(response.data);
      setGroceryOpen(true);
    } catch (error) {
      console.error("Error generating grocery list:", error);
      toast.error("Failed to generate grocery list");
    } finally {
      setIsGeneratingGrocery(false);
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

  const GroceryListDialog = () => (
    <Dialog open={groceryOpen} onOpenChange={setGroceryOpen}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Weekly Grocery List
          </DialogTitle>
        </DialogHeader>
        {groceryList && (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {groceryList.categories.map((category, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="font-semibold text-primary">{category.name}</h3>
                  <div className="space-y-1">
                    {category.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t border-border">
                <div className="flex justify-between font-semibold">
                  <span>Estimated Total</span>
                  <span className="text-primary">${groceryList.totalEstimatedCost}</span>
                </div>
              </div>

              {groceryList.shoppingTips && groceryList.shoppingTips.length > 0 && (
                <div className="pt-4">
                  <h4 className="font-semibold mb-2 text-sm">Shopping Tips</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {groceryList.shoppingTips.map((tip, idx) => (
                      <li key={idx}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
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
          <div className="mx-6 mb-4 rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground">Consumed / Planned</p>
                <p className="text-xl font-bold text-foreground">
                  <span className="text-primary">{consumedCalories}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  {mealPlan.total_calories} kcal
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Protein</p>
                <p className="text-xl font-bold">
                  <span className="text-primary">{consumedProtein}g</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  {mealPlan.total_protein}g
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Mark meals as done to track your intake
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 px-6 mb-6">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleGenerateGroceryList}
            disabled={isGeneratingGrocery}
          >
            {isGeneratingGrocery ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            Grocery List
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setActiveTab("week")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Week View
          </Button>
        </div>

        <GroceryListDialog />

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
                    id={meal.id}
                    type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                    name={meal.name}
                    calories={meal.calories}
                    protein={meal.protein}
                    carbs={meal.carbs}
                    fats={meal.fats}
                    recipe={meal.recipe}
                    description={meal.description}
                    isCompleted={meal.is_completed}
                    onToggleComplete={(completed) => toggleMealComplete(meal.id, completed)}
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
                    id={meal.id}
                    type={meal.meal_type as "breakfast" | "lunch" | "dinner" | "snack"}
                    name={meal.name}
                    calories={meal.calories}
                    protein={meal.protein}
                    carbs={meal.carbs}
                    fats={meal.fats}
                    recipe={meal.recipe}
                    description={meal.description}
                    isCompleted={meal.is_completed}
                    onToggleComplete={(completed) => toggleTomorrowComplete(meal.id, completed)}
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

          <TabsContent value="week" className="mt-4 space-y-3">
            {isLoadingWeek ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : weekPlans.length > 0 ? (
              <>
                {weekPlans.map((day) => {
                  const isToday = day.date === format(today, "yyyy-MM-dd");
                  return (
                    <div 
                      key={day.date}
                      className={`rounded-xl border p-4 ${isToday ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                            {day.dayName}
                          </span>
                          {isToday && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {day.totalCalories} kcal
                        </span>
                      </div>
                      {day.meals.length > 0 ? (
                        <div className="space-y-1">
                          {day.meals.map((meal) => (
                            <div key={meal.id} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground capitalize">{meal.meal_type}</span>
                              <span className="text-foreground truncate ml-2 flex-1 text-right">{meal.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No meals planned</p>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No meal plans for this week</p>
                <Button className="mt-4 gradient-primary" onClick={generateMealPlan}>
                  Start Planning
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
