import { Home, Utensils, Dumbbell, Camera, MessageCircle, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Utensils, label: "Meals", path: "/meals" },
  { icon: Dumbbell, label: "Workouts", path: "/workouts" },
  { icon: Camera, label: "Scan", path: "/scanner" },
  { icon: MessageCircle, label: "Coach", path: "/coach" },
  { icon: Users, label: "Community", path: "/community" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(220,20%,4%)] border-t border-[hsl(220,15%,12%)] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around py-2.5">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200",
                isActive 
                  ? "text-primary" 
                  : "text-[hsl(220,10%,40%)] hover:text-[hsl(220,10%,55%)]"
              )}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive && "drop-shadow-[0_0_8px_hsl(142,76%,45%)]"
                )} 
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive && "text-primary"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
