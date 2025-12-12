import { useState, useEffect, useCallback } from 'react';

interface HealthData {
  steps: number;
  activeEnergy: number;
  heartRate: number | null;
  hrv: number | null;
  distance: number;
}

// Type definitions for the Capacitor Health plugin
interface HealthPlugin {
  requestAuthorization(options: { read: string[]; write: string[] }): Promise<void>;
  queryQuantitySamples(options: {
    type: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<{ samples: Array<{ quantity: number }> }>;
}

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        Health?: HealthPlugin;
      };
    };
  }
}

export const useAppleHealth = () => {
  const [healthData, setHealthData] = useState<HealthData>({
    steps: 0,
    activeEnergy: 0,
    heartRate: null,
    hrv: null,
    distance: 0,
  });
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNativePlatform = useCallback(() => {
    return typeof window !== 'undefined' && 
           window.Capacitor?.isNativePlatform?.() === true;
  }, []);

  const getHealthPlugin = useCallback((): HealthPlugin | null => {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.Health || null;
  }, [isNativePlatform]);

  const requestAuthorization = useCallback(async () => {
    if (!isNativePlatform()) {
      console.log('Apple Health is only available on native iOS');
      return false;
    }

    try {
      setIsLoading(true);
      const Health = getHealthPlugin();
      if (!Health) {
        setError('Health plugin not available');
        return false;
      }
      
      await Health.requestAuthorization({
        read: [
          'steps',
          'activeEnergyBurned',
          'heartRate',
          'heartRateVariabilitySDNN',
          'distanceWalkingRunning',
        ],
        write: [],
      });

      setIsAuthorized(true);
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to authorize Apple Health:', err);
      setError('Failed to authorize Apple Health access');
      setIsAuthorized(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isNativePlatform, getHealthPlugin]);

  const fetchHealthData = useCallback(async () => {
    if (!isNativePlatform() || !isAuthorized) {
      return;
    }

    try {
      setIsLoading(true);
      const Health = getHealthPlugin();
      if (!Health) return;
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Fetch steps
      const stepsResult = await Health.queryQuantitySamples({
        type: 'steps',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
      });
      const totalSteps = stepsResult.samples.reduce((sum, s) => sum + s.quantity, 0);

      // Fetch active energy
      const energyResult = await Health.queryQuantitySamples({
        type: 'activeEnergyBurned',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
      });
      const totalEnergy = energyResult.samples.reduce((sum, s) => sum + s.quantity, 0);

      // Fetch distance
      const distanceResult = await Health.queryQuantitySamples({
        type: 'distanceWalkingRunning',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
      });
      const totalDistance = distanceResult.samples.reduce((sum, s) => sum + s.quantity, 0);

      // Fetch latest heart rate
      const heartRateResult = await Health.queryQuantitySamples({
        type: 'heartRate',
        startDate: new Date(now.getTime() - 3600000).toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });
      const latestHeartRate = heartRateResult.samples.length > 0 
        ? heartRateResult.samples[0].quantity 
        : null;

      // Fetch latest HRV
      const hrvResult = await Health.queryQuantitySamples({
        type: 'heartRateVariabilitySDNN',
        startDate: new Date(now.getTime() - 86400000).toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });
      const latestHrv = hrvResult.samples.length > 0 
        ? hrvResult.samples[0].quantity 
        : null;

      setHealthData({
        steps: Math.round(totalSteps),
        activeEnergy: Math.round(totalEnergy),
        heartRate: latestHeartRate ? Math.round(latestHeartRate) : null,
        hrv: latestHrv ? Math.round(latestHrv) : null,
        distance: Math.round(totalDistance),
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
      setError('Failed to fetch health data');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, isNativePlatform, getHealthPlugin]);

  useEffect(() => {
    if (isAuthorized) {
      fetchHealthData();
    }
  }, [isAuthorized, fetchHealthData]);

  return {
    healthData,
    isAuthorized,
    isLoading,
    error,
    requestAuthorization,
    fetchHealthData,
    isNativePlatform: isNativePlatform(),
  };
};
