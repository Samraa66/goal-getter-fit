import { AppLayout } from "@/components/layout/AppLayout";
import { Users, MessageSquare, Trophy, Heart } from "lucide-react";

export default function Community() {
  return (
    <AppLayout>
      <div className="dark min-h-screen bg-background">
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          <p className="text-muted-foreground">Connect with others on your fitness journey</p>
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-full bg-primary/10 p-6 mb-6">
            <Users className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-xs">
            We're building a community where you can share progress, get motivation, and connect with others.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-xs">
            <div className="rounded-xl bg-card border border-border p-4 text-center">
              <MessageSquare className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Discussion Forums</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-4 text-center">
              <Trophy className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Challenges</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-4 text-center">
              <Heart className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Support Groups</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-4 text-center">
              <Users className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Find Buddies</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
