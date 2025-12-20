import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      if (!user) {
        setProfileLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          setOnboardingCompleted(false);
        } else {
          setOnboardingCompleted(data?.onboarding_completed ?? false);
        }
      } catch (err) {
        console.error("Profile check error:", err);
        setOnboardingCompleted(false);
      } finally {
        setProfileLoading(false);
      }
    }

    if (!authLoading) {
      checkOnboarding();
    }
  }, [user, authLoading]);

  // Show loading while checking auth or profile
  if (authLoading || profileLoading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in → redirect to /auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isOnboardingRoute = location.pathname === "/onboarding";

  // User has completed onboarding but is trying to access /onboarding → redirect to home
  if (isOnboardingRoute && onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  // User hasn't completed onboarding and is NOT on /onboarding → force to onboarding
  if (requireOnboarding && !onboardingCompleted && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
