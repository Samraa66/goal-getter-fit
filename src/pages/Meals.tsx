import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MealCard } from "@/components/meals/MealCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Calendar, Plus } from "lucide-react";

const mockMeals = {
  today: [
    { type: "breakfast" as const, name: "Greek Yogurt Bowl", calories: 350, protein: 25, carbs: 40, fats: 12, time: "8:00 AM" },
    { type: "lunch" as const, name: "Grilled Chicken Salad", calories: 450, protein: 35, carbs: 25, fats: 18, time: "12:30 PM" },
    { type: "snack" as const, name: "Protein Smoothie", calories: 200, protein: 20, carbs: 25, fats: 5, time: "3:00 PM" },
    { type: "dinner" as const, name: "Salmon with Vegetables", calories: 550, protein: 40, carbs: 30, fats: 22, time: "7:00 PM" },
  ],
};

export default function Meals() {
  const [activeTab, setActiveTab] = useState("today");

  const totalCalories = mockMeals.today.reduce((sum, meal) => sum + meal.calories, 0);
  const totalProtein = mockMeals.today.reduce((sum, meal) => sum + meal.protein, 0);

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Meal Plan</h1>
          <p className="text-muted-foreground">Plan your nutrition for the week</p>
        </div>

        {/* Summary Bar */}
        <div className="mx-6 mb-4 flex items-center justify-between rounded-xl bg-card border border-border p-4">
          <div>
            <p className="text-sm text-muted-foreground">Today's Total</p>
            <p className="text-xl font-bold text-foreground">{totalCalories} kcal</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Protein</p>
            <p className="text-xl font-bold text-primary">{totalProtein}g</p>
          </div>
        </div>

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
            {mockMeals.today.map((meal, index) => (
              <MealCard
                key={index}
                {...meal}
                onSwap={() => console.log("Swap meal:", meal.name)}
              />
            ))}
            <Button variant="outline" className="w-full border-dashed">
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Meal
            </Button>
          </TabsContent>

          <TabsContent value="tomorrow" className="mt-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Tomorrow's meals will be generated soon</p>
              <Button className="mt-4 gradient-primary">Generate Plan</Button>
            </div>
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
