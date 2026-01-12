import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

/**
 * PageContainer provides consistent viewport handling for all main pages.
 * It calculates height based on the bottom nav bar (56px + safe area).
 * 
 * Use scrollable=true (default) for pages with scrolling content.
 * Use scrollable=false for pages that manage their own scroll containers.
 */
export function PageContainer({ 
  children, 
  className,
  scrollable = true 
}: PageContainerProps) {
  return (
    <div 
      className={cn(
        "dark bg-background flex flex-col",
        scrollable ? "overflow-y-auto" : "overflow-hidden",
        className
      )}
      style={{ 
        height: "calc(100dvh - 56px - env(safe-area-inset-bottom, 0px))" 
      }}
    >
      {children}
    </div>
  );
}
