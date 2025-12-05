import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface OnboardingStepProps {
  title: string;
  description: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  canProceed?: boolean;
}

export function OnboardingStep({
  title,
  description,
  children,
  onNext,
  onBack,
  isFirst = false,
  isLast = false,
  canProceed = true,
}: OnboardingStepProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        
        <div className="mt-8">{children}</div>
      </div>

      <div className="flex gap-3 pt-6">
        {!isFirst && onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className={`flex-1 gradient-primary ${!canProceed && "opacity-50"}`}
        >
          {isLast ? "Get Started" : "Continue"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
