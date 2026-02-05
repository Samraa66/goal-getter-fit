import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Settings, 
  Target, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Scale,
  Ruler,
  Flame,
  Loader2,
  Crown,
  CreditCard,
  FlaskConical
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProBadge } from "@/components/subscription/ProBadge";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";

const menuItems = [
  { icon: Target, label: "Goals & Preferences", path: "/settings/goals" },
  { icon: Bell, label: "Notifications", path: "/settings/notifications" },
  { icon: Shield, label: "Privacy & Security", path: "/settings/privacy" },
  { icon: HelpCircle, label: "Help & Support", path: "/settings/help" },
];

interface ProfileData {
  full_name: string | null;
  email: string | null;
  fitness_goal: string | null;
  weight_current: number | null;
  height_cm: number | null;
  daily_calorie_target: number | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const { isPro, subscriptionEnd, openCustomerPortal, openCheckout, isLoading: isSubLoading } = useSubscription();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!authUser) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, fitness_goal, weight_current, height_cm, daily_calorie_target")
        .eq("id", authUser.id)
        .single();
      
      if (!error && data) {
        setProfile(data);
      }
      setIsLoading(false);
    }
    
    fetchProfile();
  }, [authUser]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast({
        title: "Logged out",
        description: "You've been successfully logged out.",
      });
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const goalLabels: Record<string, string> = {
    lose_weight: "Lose Weight",
    gain_muscle: "Build Muscle",
    maintain: "Maintain",
    improve_fitness: "Get Healthier",
  };

  const displayData = {
    name: profile?.full_name || authUser?.email?.split("@")[0] || "User",
    email: profile?.email || authUser?.email || "",
    goal: profile?.fitness_goal ? goalLabels[profile.fitness_goal] || profile.fitness_goal : "Not set",
    weight: profile?.weight_current || 0,
    height: profile?.height_cm || 0,
    dailyCalories: profile?.daily_calorie_target || 2000,
  };

  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="mx-6 mb-6 rounded-xl bg-card border border-border p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{displayData.name}</h2>
                <p className="text-sm text-muted-foreground">{displayData.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  {displayData.goal}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 px-6 mb-6">
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <Scale className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">{displayData.weight || "—"}</p>
            <p className="text-xs text-muted-foreground">kg</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <Ruler className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">{displayData.height || "—"}</p>
            <p className="text-xs text-muted-foreground">cm</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <Flame className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">{displayData.dailyCalories}</p>
            <p className="text-xs text-muted-foreground">kcal/day</p>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="mx-6 mb-6">
          <div className={`rounded-xl border p-4 ${isPro ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crown className={`h-5 w-5 ${isPro ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-medium text-foreground">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </span>
                {isPro && <ProBadge size="sm" />}
              </div>
            </div>
            
            {isPro ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Unlimited messages, full memory
                  {subscriptionEnd && (
                    <span className="block text-xs mt-1">
                      Renews: {new Date(subscriptionEnd).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setIsOpeningPortal(true);
                    await openCustomerPortal();
                    setIsOpeningPortal(false);
                  }}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  10 messages/day, limited history
                </p>
                <Button 
                  size="sm"
                  className="w-full gradient-primary"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Pro — $9.99/mo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-6 space-y-2">
          {menuItems.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-4 rounded-xl bg-card border border-border p-4 hover:bg-secondary/50 transition-colors"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-left text-foreground">{label}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Beta Disclaimer */}
        <div className="mx-6 mt-6 rounded-xl bg-muted/50 border border-border p-4">
          <div className="flex items-start gap-3">
            <FlaskConical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Beta Version</p>
              <p className="text-xs text-muted-foreground mt-1">
                Features and limits may change as we improve. Thanks for being an early user!
              </p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="px-6 mt-8 pb-8">
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Sign Out
          </Button>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal 
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          reason="feature"
        />
      </div>
    </AppLayout>
  );
}
