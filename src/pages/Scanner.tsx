import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2, Utensils, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MenuAnalysis {
  summary: string;
  healthyChoices: Array<{
    name: string;
    reason: string;
    modifications?: string[];
  }>;
  recommendation: {
    name: string;
    reason: string;
  };
}

export default function Scanner() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MenuAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-menu", {
        body: { image },
      });

      if (fnError) throw fnError;

      setAnalysis(data);
      toast({
        title: "Menu analyzed!",
        description: "Here are your healthy options.",
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
          <p className="text-muted-foreground">Scan restaurant menus for healthy options</p>
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
                  className="w-full rounded-xl object-cover max-h-[300px]"
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

              {!analysis && !isAnalyzing && (
                <Button
                  className="w-full gradient-primary"
                  onClick={analyzeMenu}
                >
                  <Utensils className="mr-2 h-4 w-4" />
                  Analyze Menu
                </Button>
              )}

              {isAnalyzing && (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-4 text-muted-foreground">Analyzing menu...</p>
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
                  {/* Summary */}
                  <div className="rounded-xl bg-card border border-border p-4">
                    <h3 className="font-semibold text-foreground mb-2">Menu Summary</h3>
                    <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                  </div>

                  {/* Recommendation */}
                  <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                    <h3 className="font-semibold text-primary mb-2">🎯 Top Pick</h3>
                    <p className="font-medium text-foreground">{analysis.recommendation.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.recommendation.reason}</p>
                  </div>

                  {/* Healthy Choices */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Healthy Options</h3>
                    {analysis.healthyChoices.map((choice, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-card border border-border p-4"
                      >
                        <p className="font-medium text-foreground">{choice.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{choice.reason}</p>
                        {choice.modifications && choice.modifications.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-primary font-medium">Suggested modifications:</p>
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
