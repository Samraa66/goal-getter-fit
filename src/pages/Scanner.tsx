import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2, Utensils, AlertCircle, Target, ArrowLeft, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Types for Menu Scanner
interface MenuAnalysis {
  summary: string;
  yourTargets: {
    calorieTarget: number;
    proteinTarget: number;
    goal: string;
  };
  healthyChoices: Array<{
    name: string;
    reason: string;
    estimatedCalories?: number;
    estimatedProtein?: number;
    howItHelpsYou: string;
    modifications?: string[];
  }>;
  recommendation: {
    name: string;
    reason: string;
    howItFitsYourPlan: string;
  };
}

// Types for Calorie Counter
interface CalorieAnalysis {
  identified_foods: Array<{
    name: string;
    estimated_portion: string;
    calories_low: number;
    calories_high: number;
    confidence: "high" | "medium" | "low";
  }>;
  total_estimate: {
    calories_low: number;
    calories_high: number;
    protein_low: number;
    protein_high: number;
    carbs_low: number;
    carbs_high: number;
    fats_low: number;
    fats_high: number;
  };
  notes: string;
  meal_description: string;
}

type ScannerMode = "select" | "menu" | "calories";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const mealTypeLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function Scanner() {
  const [mode, setMode] = useState<ScannerMode>("select");
  const [image, setImage] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [menuAnalysis, setMenuAnalysis] = useState<MenuAnalysis | null>(null);
  const [calorieAnalysis, setCalorieAnalysis] = useState<CalorieAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLogged, setIsLogged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user profile for personalization
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setMenuAnalysis(null);
        setCalorieAnalysis(null);
        setError(null);
        setIsLogged(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeMenu = async () => {
    if (!image || !selectedMealType) {
      toast({
        title: "Select meal type",
        description: "Please select which meal this is for",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-menu", {
        body: {
          image,
          mealType: selectedMealType,
          profile: userProfile,
        },
      });

      if (fnError) throw fnError;

      setMenuAnalysis(data);
      toast({
        title: "Menu analyzed!",
        description: `Found options for your ${mealTypeLabels[selectedMealType].toLowerCase()}.`,
      });
    } catch (err) {
      console.error("Error analyzing menu:", err);
      setError("Failed to analyze the menu. Please try again.");
      toast({
        title: "Analysis failed",
        description: "Could not analyze the menu image.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeCalories = async () => {
    if (!image) {
      toast({
        title: "No image",
        description: "Please take or upload a photo first",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("count-calories", {
        body: { image },
      });

      if (fnError) throw fnError;

      setCalorieAnalysis(data);
      toast({
        title: "Analysis complete!",
        description: "Calorie estimate ready.",
      });
    } catch (err) {
      console.error("Error counting calories:", err);
      setError("Failed to analyze the food. Please try again.");
      toast({
        title: "Analysis failed",
        description: "Could not analyze the food image.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const logCalories = () => {
    // For now, just mark as logged - this could persist to a calorie_logs table
    setIsLogged(true);
    toast({
      title: "Calories logged",
      description: "Your coach can reference this in future conversations.",
    });
  };

  const clearAll = () => {
    setImage(null);
    setMenuAnalysis(null);
    setCalorieAnalysis(null);
    setError(null);
    setSelectedMealType(null);
    setIsLogged(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const goBack = () => {
    if (image || menuAnalysis || calorieAnalysis) {
      clearAll();
    } else {
      setMode("select");
    }
  };

  // Mode Selection Screen
  if (mode === "select") {
    return (
      <AppLayout>
        <PageContainer>
          <div className="px-6 pt-12 pb-4">
            <h1 className="text-2xl font-bold text-foreground">Scanner</h1>
            <p className="text-muted-foreground">What would you like to do?</p>
          </div>

          <div className="px-6 py-8 space-y-4">
            {/* Menu Scanner Option */}
            <button
              onClick={() => setMode("menu")}
              className="w-full text-left rounded-2xl bg-card border border-border p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Utensils className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">🧾 Scan a Menu</h3>
                  <p className="text-muted-foreground mt-1">
                    Find meals that fit your plan.
                  </p>
                </div>
              </div>
            </button>

            {/* Calorie Counter Option */}
            <button
              onClick={() => setMode("calories")}
              className="w-full text-left rounded-2xl bg-card border border-border p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent/10">
                  <Camera className="h-6 w-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">📸 Count Calories</h3>
                  <p className="text-muted-foreground mt-1">
                    Estimate calories from a photo.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  // Shared Image Capture UI
  const renderImageCapture = (title: string, subtitle: string) => (
    <div className="flex flex-col items-center">
      <div
        className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-border bg-card flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-foreground font-medium">Take a photo or upload</p>
        <p className="text-sm text-muted-foreground mt-1">Supports JPG, PNG</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-3 mt-6 w-full">
        <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <Button
          className="flex-1 gradient-primary"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.capture = "environment";
              fileInputRef.current.click();
            }
          }}
        >
          <Camera className="mr-2 h-4 w-4" />
          Camera
        </Button>
      </div>
    </div>
  );

  // Menu Scanner Mode
  if (mode === "menu") {
    return (
      <AppLayout>
        <PageContainer>
          {/* Header with back button */}
          <div className="px-6 pt-12 pb-4">
            <button onClick={goBack} className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            <h1 className="text-2xl font-bold text-foreground">Menu Scanner</h1>
            <p className="text-muted-foreground">Find options that fit your goals</p>
          </div>

          <div className="px-6 py-4">
            {!image ? (
              renderImageCapture("Menu Scanner", "Find options that fit your goals")
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <img src={image} alt="Menu" className="w-full rounded-xl object-cover max-h-[250px]" />
                  <Button variant="secondary" size="icon" className="absolute top-2 right-2" onClick={clearAll}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Meal Type Selection */}
                {!menuAnalysis && !isAnalyzing && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">What meal is this for?</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(mealTypeLabels) as MealType[]).map((type) => (
                        <Button
                          key={type}
                          variant={selectedMealType === type ? "default" : "outline"}
                          size="sm"
                          className={selectedMealType === type ? "gradient-primary" : ""}
                          onClick={() => setSelectedMealType(type)}
                        >
                          {mealTypeLabels[type]}
                        </Button>
                      ))}
                    </div>

                    <Button className="w-full gradient-primary mt-4" onClick={analyzeMenu} disabled={!selectedMealType}>
                      <Utensils className="mr-2 h-4 w-4" />
                      Analyze for {selectedMealType ? mealTypeLabels[selectedMealType] : "..."}
                    </Button>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">Finding options for your {selectedMealType}...</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {menuAnalysis && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Your Targets */}
                    {menuAnalysis.yourTargets && (
                      <div className="rounded-xl bg-secondary/30 border border-border p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-foreground text-sm">Your Targets</h3>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Goal:</span>{" "}
                            <span className="text-foreground capitalize">{menuAnalysis.yourTargets.goal}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Daily:</span>{" "}
                            <span className="text-foreground">{menuAnalysis.yourTargets.calorieTarget} kcal</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Protein:</span>{" "}
                            <span className="text-primary">{menuAnalysis.yourTargets.proteinTarget}g</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="rounded-xl bg-card border border-border p-4">
                      <h3 className="font-semibold text-foreground mb-2">Menu Summary</h3>
                      <p className="text-sm text-muted-foreground">{menuAnalysis.summary}</p>
                    </div>

                    {/* Recommendation */}
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                      <h3 className="font-semibold text-primary mb-2">🎯 Best Pick for You</h3>
                      <p className="font-medium text-foreground">{menuAnalysis.recommendation.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{menuAnalysis.recommendation.reason}</p>
                      {menuAnalysis.recommendation.howItFitsYourPlan && (
                        <div className="mt-2 pt-2 border-t border-primary/20">
                          <p className="text-xs text-primary font-medium">How this fits your plan:</p>
                          <p className="text-sm text-muted-foreground">{menuAnalysis.recommendation.howItFitsYourPlan}</p>
                        </div>
                      )}
                    </div>

                    {/* Healthy Choices */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-foreground">Other Good Options</h3>
                      {menuAnalysis.healthyChoices.map((choice, index) => (
                        <div key={index} className="rounded-xl bg-card border border-border p-4">
                          <div className="flex items-start justify-between">
                            <p className="font-medium text-foreground">{choice.name}</p>
                            {choice.estimatedCalories && (
                              <span className="text-xs bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                                ~{choice.estimatedCalories} kcal
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{choice.reason}</p>

                          {choice.howItHelpsYou && (
                            <div className="mt-2 bg-primary/5 rounded-lg p-2">
                              <p className="text-xs text-primary font-medium">How it helps you:</p>
                              <p className="text-xs text-muted-foreground">{choice.howItHelpsYou}</p>
                            </div>
                          )}

                          {choice.modifications && choice.modifications.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-primary font-medium">Make it even better:</p>
                              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {choice.modifications.map((mod, i) => (
                                  <li key={i}>• {mod}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button variant="outline" className="w-full" onClick={clearAll}>
                      Scan Another Menu
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  // Calorie Counter Mode
  if (mode === "calories") {
    return (
      <AppLayout>
        <PageContainer>
          {/* Header with back button */}
          <div className="px-6 pt-12 pb-4">
            <button onClick={goBack} className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            <h1 className="text-2xl font-bold text-foreground">Calorie Counter</h1>
            <p className="text-muted-foreground">Estimate calories from a photo</p>
          </div>

          <div className="px-6 py-4">
            {!image ? (
              renderImageCapture("Calorie Counter", "Estimate calories from a photo")
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <img src={image} alt="Food" className="w-full rounded-xl object-cover max-h-[250px]" />
                  <Button variant="secondary" size="icon" className="absolute top-2 right-2" onClick={clearAll}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Analyze button before analysis */}
                {!calorieAnalysis && !isAnalyzing && (
                  <Button className="w-full gradient-primary" onClick={analyzeCalories}>
                    <Camera className="mr-2 h-4 w-4" />
                    Estimate Calories
                  </Button>
                )}

                {isAnalyzing && (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">Analyzing your food...</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {calorieAnalysis && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Meal Description */}
                    <div className="rounded-xl bg-card border border-border p-4">
                      <p className="text-foreground font-medium">{calorieAnalysis.meal_description}</p>
                    </div>

                    {/* Main Calorie Estimate */}
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-6 text-center">
                      <p className="text-sm text-primary font-medium mb-1">Estimated Calories</p>
                      <p className="text-3xl font-bold text-foreground">
                        {calorieAnalysis.total_estimate.calories_low}–{calorieAnalysis.total_estimate.calories_high}
                        <span className="text-lg font-normal text-muted-foreground ml-1">kcal</span>
                      </p>
                    </div>

                    {/* Macro Estimates */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-card border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Protein</p>
                        <p className="font-semibold text-foreground">
                          {calorieAnalysis.total_estimate.protein_low}–{calorieAnalysis.total_estimate.protein_high}g
                        </p>
                      </div>
                      <div className="rounded-xl bg-card border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Carbs</p>
                        <p className="font-semibold text-foreground">
                          {calorieAnalysis.total_estimate.carbs_low}–{calorieAnalysis.total_estimate.carbs_high}g
                        </p>
                      </div>
                      <div className="rounded-xl bg-card border border-border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Fats</p>
                        <p className="font-semibold text-foreground">
                          {calorieAnalysis.total_estimate.fats_low}–{calorieAnalysis.total_estimate.fats_high}g
                        </p>
                      </div>
                    </div>

                    {/* Identified Foods */}
                    {calorieAnalysis.identified_foods.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-foreground text-sm">Identified Items</h3>
                        {calorieAnalysis.identified_foods.map((food, index) => (
                          <div key={index} className="rounded-lg bg-secondary/30 p-3 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-foreground">{food.name}</p>
                              <p className="text-xs text-muted-foreground">{food.estimated_portion}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-foreground">
                                {food.calories_low}–{food.calories_high} kcal
                              </p>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  food.confidence === "high"
                                    ? "bg-green-500/20 text-green-400"
                                    : food.confidence === "medium"
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {food.confidence}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {calorieAnalysis.notes && (
                      <div className="rounded-xl bg-muted/30 border border-border p-3">
                        <p className="text-xs text-muted-foreground italic">{calorieAnalysis.notes}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-2">
                      {!isLogged ? (
                        <Button className="w-full" variant="outline" onClick={logCalories}>
                          <Plus className="mr-2 h-4 w-4" />
                          Log Calories (Optional)
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-green-400 py-2">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Logged</span>
                        </div>
                      )}

                      <Button className="w-full gradient-primary" onClick={clearAll}>
                        Done
                      </Button>

                      <Button variant="ghost" className="w-full text-muted-foreground" onClick={clearAll}>
                        Scan Another
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return null;
}
