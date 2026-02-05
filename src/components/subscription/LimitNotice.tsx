import { Button } from "@/components/ui/button";
import { Crown, Clock } from "lucide-react";

interface LimitNoticeProps {
  messagesUsed: number;
  messagesLimit: number;
  onUpgradeClick: () => void;
}

export function LimitNotice({ messagesUsed, messagesLimit, onUpgradeClick }: LimitNoticeProps) {
  const remaining = messagesLimit - messagesUsed;
  const isNearLimit = remaining <= 3 && remaining > 0;
  const isAtLimit = remaining <= 0;

  if (!isNearLimit && !isAtLimit) return null;

  return (
    <div className={`px-4 py-3 flex items-center justify-between gap-3 border-t ${
      isAtLimit 
        ? 'bg-destructive/10 border-destructive/20' 
        : 'bg-primary/10 border-primary/20'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {isAtLimit ? (
          <Clock className="h-4 w-4 text-destructive shrink-0" />
        ) : (
          <Crown className="h-4 w-4 text-primary shrink-0" />
        )}
        <span className={`text-sm font-medium truncate ${
          isAtLimit ? 'text-destructive' : 'text-primary'
        }`}>
          {isAtLimit 
            ? "Daily limit reached — resets tomorrow" 
            : `${remaining} message${remaining !== 1 ? 's' : ''} left today`
          }
        </span>
      </div>
      <Button 
        size="sm" 
        variant={isAtLimit ? "default" : "outline"}
        className={isAtLimit ? "gradient-primary shrink-0" : "shrink-0"}
        onClick={onUpgradeClick}
      >
        <Crown className="h-3 w-3 mr-1" />
        Upgrade
      </Button>
    </div>
  );
}
