import { Flame, Target, TrendingUp, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  colorClass?: string;
}

function StatCard({ icon: Icon, label, value, subtext, colorClass = "text-primary" }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-4 border border-border">
      <div className={cn("rounded-lg bg-primary/10 p-2", colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );
}

interface QuickStatsProps {
  calories: { consumed: number; target: number };
  protein: { consumed: number; target: number };
  water: { consumed: number; target: number };
  streak: number;
}

export function QuickStats({ calories, protein, water, streak }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon={Flame}
        label="Calories"
        value={`${calories.consumed}`}
        subtext={`of ${calories.target} kcal`}
      />
      <StatCard
        icon={Target}
        label="Protein"
        value={`${protein.consumed}g`}
        subtext={`of ${protein.target}g`}
      />
      <StatCard
        icon={Droplets}
        label="Water"
        value={`${water.consumed}L`}
        subtext={`of ${water.target}L`}
      />
      <StatCard
        icon={TrendingUp}
        label="Streak"
        value={`${streak} days`}
        subtext="Keep it up!"
      />
    </div>
  );
}
