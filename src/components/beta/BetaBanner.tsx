import { useState } from "react";
import { X, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('beta-banner-dismissed') === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem('beta-banner-dismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
      <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-primary font-medium truncate">
            Beta — Features may change. We'd love your feedback!
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-6 w-6 shrink-0 text-primary hover:text-primary/80"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
