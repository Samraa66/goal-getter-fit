import { useEffect, useCallback } from "react";

// Simple event emitter for cross-component communication
type RefreshEvent = "meals" | "workouts" | "both";

const listeners = new Set<(event: RefreshEvent) => void>();

export function emitPlanRefresh(event: RefreshEvent) {
  console.log("Emitting plan refresh:", event);
  listeners.forEach((listener) => listener(event));
}

export function usePlanRefreshListener(
  onRefresh: (event: RefreshEvent) => void
) {
  useEffect(() => {
    listeners.add(onRefresh);
    return () => {
      listeners.delete(onRefresh);
    };
  }, [onRefresh]);
}

export function usePlanRefresh(
  refetchMeals?: () => void,
  refetchWorkouts?: () => void
) {
  const handleRefresh = useCallback(
    (event: RefreshEvent) => {
      if ((event === "meals" || event === "both") && refetchMeals) {
        console.log("Refreshing meals...");
        refetchMeals();
      }
      if ((event === "workouts" || event === "both") && refetchWorkouts) {
        console.log("Refreshing workouts...");
        refetchWorkouts();
      }
    },
    [refetchMeals, refetchWorkouts]
  );

  usePlanRefreshListener(handleRefresh);
}
