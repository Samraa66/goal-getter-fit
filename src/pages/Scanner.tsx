import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2, Utensils, AlertCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const mealTypeLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch", 
  dinner: "Dinner",
  snack: "Snack",
};

export default function Scanner() {
  const [image, setImage] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MenuAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
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
        setAnalysis(null);
        setError(null);
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

      setAnalysis(data);
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

  const clearImage = () => {
    setImage(null);
    setAnalysis(null);
    setError(null);
    setSelectedMealType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Menu Scanner</h1>
          <p className="text-muted-foreground">Find options that fit your goals</p>
        </div>

        <div className="px-6 py-4">
          {!image ? (
            /* Upload Section */
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
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
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
          ) : (
            /* Image Preview & Analysis */
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={image}
                  alt="Menu"
                  className="w-full rounded-xl object-cover max-h-[250px]"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Meal Type Selection */}
              {!analysis && !isAnalyzing && (
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

                  <Button
                    className="w-full gradient-primary mt-4"
                    onClick={analyzeMenu}
                    disabled={!selectedMealType}
                  >
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

              {analysis && (
                <div className="space-y-4 animate-fade-in">
                  {/* Your Targets */}
                  {analysis.yourTargets && (
                    <div className="rounded-xl bg-secondary/30 border border-border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-foreground text-sm">Your Targets</h3>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Goal:</span>{" "}
                          <span className="text-foreground capitalize">{analysis.yourTargets.goal}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Daily:</span>{" "}
                          <span className="text-foreground">{analysis.yourTargets.calorieTarget} kcal</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Protein:</span>{" "}
                          <span className="text-primary">{analysis.yourTargets.proteinTarget}g</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="font-semibold text-foreground mb-2">Menu Summary</h3>
                    <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                  </div>

                  {/* Recommendation */}
                  <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                    <h3 className="font-semibold text-primary mb-2">🎯 Best Pick for You</h3>
                    <p className="font-medium text-foreground">{analysis.recommendation.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.recommendation.reason}</p>
                    {analysis.recommendation.howItFitsYourPlan && (
                      <div className="mt-2 pt-2 border-t border-primary/20">
                        <p className="text-xs text-primary font-medium">How this fits your plan:</p>
                        <p className="text-sm text-muted-foreground">{analysis.recommendation.howItFitsYourPlan}</p>
                      </div>
                    )}
                  </div>

                  {/* Healthy Choices */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Other Good Options</h3>
                    {analysis.healthyChoices.map((choice, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-card border border-border p-4"
                      >
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

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={clearImage}
                  >
                    Scan Another Menu
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
