import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  className?: string;
  size?: "sm" | "default";
}

export function ProBadge({ className, size = "default" }: ProBadgeProps) {
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className
      )}
    >
      <Crown className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Pro
    </span>
  );
}
