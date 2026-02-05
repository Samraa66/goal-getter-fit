import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { FeedbackButton } from "@/components/beta/FeedbackButton";

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

// Bottom nav height: 56px (py-2 + icon + text) + safe area
const NAV_HEIGHT = "calc(56px + env(safe-area-inset-bottom, 0px))";

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <main 
        className={hideNav ? "" : ""} 
        style={hideNav ? undefined : { paddingBottom: NAV_HEIGHT }}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <FeedbackButton />
    </div>
  );
}
