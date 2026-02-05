import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, MessageCircle, Brain, Zap, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: "message_limit" | "memory_limit" | "feature";
  messagesUsed?: number;
  messagesLimit?: number;
}

const BENEFITS = [
  { icon: MessageCircle, text: "Unlimited daily messages" },
  { icon: Brain, text: "Full conversation memory" },
  { icon: Zap, text: "Faster response times" },
  { icon: Crown, text: "Priority support" },
];

export function UpgradeModal({ 
  open, 
  onOpenChange, 
  reason = "message_limit",
  messagesUsed = 0,
  messagesLimit = 10
}: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) {
        console.error('Checkout error:', error);
        toast({
          title: "Unable to start checkout",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (reason) {
      case "message_limit":
        return "You've reached today's message limit";
      case "memory_limit":
        return "Unlock full conversation memory";
      case "feature":
        return "Upgrade to Pro";
      default:
        return "Upgrade to Pro";
    }
  };

  const getDescription = () => {
    switch (reason) {
      case "message_limit":
        return `You've used ${messagesUsed} of ${messagesLimit} daily messages. Upgrade to Pro for unlimited coaching conversations.`;
      case "memory_limit":
        return "Free accounts have limited conversation history. Upgrade for full memory and better personalization.";
      case "feature":
        return "Get the most out of your AI coach with unlimited access.";
      default:
        return "Unlock the full potential of your AI coach.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3 w-fit">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">{getTitle()}</DialogTitle>
          <DialogDescription className="text-base">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-foreground">$9.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <div className="rounded-full bg-primary/10 p-1">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-foreground">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button 
            onClick={handleUpgrade} 
            className="w-full gradient-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opening checkout...
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime. Your current plan stays active until the billing period ends.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
