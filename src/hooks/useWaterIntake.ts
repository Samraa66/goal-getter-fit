import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";
import { toast } from "sonner";

interface WaterIntake {
  id?: string;
  glasses: number;
  targetGlasses: number;
  liters: number;
  targetLiters: number;
}

export function useWaterIntake(date: Date = new Date()) {
  const { user } = useAuth();
  const [waterIntake, setWaterIntake] = useState<WaterIntake>({
    glasses: 0,
    targetGlasses: 8,
    liters: 0,
    targetLiters: 2.5,
  });
  const [isLoading, setIsLoading] = useState(true);

  const dateStr = format(date, "yyyy-MM-dd");

  const fetchWaterIntake = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("progress_logs")
        .select("id, water_glasses")
        .eq("user_id", user.id)
        .eq("log_date", dateStr)
        .maybeSingle();

      if (error) throw error;

      const glasses = data?.water_glasses || 0;
      setWaterIntake({
        id: data?.id,
        glasses,
        targetGlasses: 8,
        liters: parseFloat((glasses * 0.25).toFixed(1)),
        targetLiters: 2.5,
      });
    } catch (error) {
      console.error("Error fetching water intake:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, dateStr]);

  const addWater = async (glasses: number = 1) => {
    if (!user) return;

    const newGlasses = waterIntake.glasses + glasses;
    
    // Prevent exceeding reasonable limit (e.g., 20 glasses = 5L)
    if (newGlasses > 20) {
      toast.info("Maximum water intake reached for today");
      return;
    }
    
    try {
      if (waterIntake.id) {
        const { error } = await supabase
          .from("progress_logs")
          .update({ water_glasses: newGlasses })
          .eq("id", waterIntake.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("progress_logs")
          .insert({
            user_id: user.id,
            log_date: dateStr,
            water_glasses: newGlasses,
          })
          .select()
          .single();

        if (error) throw error;
        
        setWaterIntake(prev => ({ ...prev, id: data.id }));
      }

      setWaterIntake(prev => ({
        ...prev,
        glasses: newGlasses,
        liters: parseFloat((newGlasses * 0.25).toFixed(1)),
      }));

      if (newGlasses >= waterIntake.targetGlasses && waterIntake.glasses < waterIntake.targetGlasses) {
        toast.success("Daily water goal reached!");
      }
    } catch (error) {
      console.error("Error updating water intake:", error);
      toast.error("Failed to log water");
    }
  };

  const removeWater = async (glasses: number = 1) => {
    if (!user || waterIntake.glasses <= 0) return;

    const newGlasses = Math.max(0, waterIntake.glasses - glasses);
    
    try {
      if (waterIntake.id) {
        const { error } = await supabase
          .from("progress_logs")
          .update({ water_glasses: newGlasses })
          .eq("id", waterIntake.id);

        if (error) throw error;

        setWaterIntake(prev => ({
          ...prev,
          glasses: newGlasses,
          liters: parseFloat((newGlasses * 0.25).toFixed(1)),
        }));
      }
    } catch (error) {
      console.error("Error updating water intake:", error);
      toast.error("Failed to update water");
    }
  };

  useEffect(() => {
    fetchWaterIntake();
  }, [fetchWaterIntake]);

  return {
    ...waterIntake,
    isLoading,
    addWater,
    removeWater,
    refetch: fetchWaterIntake,
  };
}
