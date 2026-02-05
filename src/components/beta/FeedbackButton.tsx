import { useState } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    
    setIsSubmitting(true);
    
    // For beta, just log and show confirmation
    // In production, this would send to your feedback endpoint
    console.log("Feedback submitted:", feedback);
    
    // Simulate brief delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    toast({
      title: "Thanks for your feedback!",
      description: "We read every message and use it to improve Forme.",
    });
    
    setFeedback("");
    setOpen(false);
    setIsSubmitting(false);
  };

  return (
    <>
      {/* Mobile: Fixed button */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <Button 
          size="icon"
          variant="outline"
          className="rounded-full h-10 w-10 bg-card shadow-lg border-border"
          onClick={() => setOpen(true)}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop: Popover in corner */}
      <div className="fixed bottom-6 right-6 z-40 hidden md:block">
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              size="sm"
              variant="outline"
              className="rounded-full bg-card shadow-lg border-border"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Feedback
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80" 
            align="end"
            side="top"
          >
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">Send us feedback</h4>
                <p className="text-xs text-muted-foreground">
                  Found a bug? Have an idea? We'd love to hear it.
                </p>
              </div>
              <Textarea 
                placeholder="What's on your mind?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <Button 
                size="sm" 
                className="w-full"
                disabled={!feedback.trim() || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send feedback
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send us feedback</DialogTitle>
            <DialogDescription>
              Found a bug? Have an idea? We'd love to hear it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea 
              placeholder="What's on your mind?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[120px]"
            />
            <Button 
              className="w-full"
              disabled={!feedback.trim() || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
