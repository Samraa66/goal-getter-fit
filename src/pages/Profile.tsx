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
  Flame
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { icon: Target, label: "Goals & Preferences", path: "/settings/goals" },
  { icon: Bell, label: "Notifications", path: "/settings/notifications" },
  { icon: Shield, label: "Privacy & Security", path: "/settings/privacy" },
  { icon: HelpCircle, label: "Help & Support", path: "/settings/help" },
];

export default function Profile() {
  const navigate = useNavigate();

  // Mock user data
  const user = {
    name: "Alex Johnson",
    email: "alex@example.com",
    goal: "Lose Weight",
    weight: 75,
    height: 175,
    dailyCalories: 2000,
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
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                {user.goal}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 px-6 mb-6">
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <Scale className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">{user.weight}</p>
            <p className="text-xs text-muted-foreground">kg</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <Ruler className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">{user.height}</p>
            <p className="text-xs text-muted-foreground">cm</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <Flame className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">{user.dailyCalories}</p>
            <p className="text-xs text-muted-foreground">kcal/day</p>
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

        {/* Logout */}
        <div className="px-6 mt-8 pb-8">
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
