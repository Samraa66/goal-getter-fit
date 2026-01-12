import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatHistorySidebar } from "@/components/coach/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Loader2, RefreshCw, History, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfileUpdates } from "@/hooks/useProfileUpdates";
import { useChatSessions } from "@/hooks/useChatSessions";
import { cn } from "@/lib/utils";

interface UserProfile {
  fitness_goal: string | null;
  experience_level: string | null;
  workout_location: string | null;
  dietary_preference: string | null;
  allergies: string[] | null;
  disliked_foods: string[] | null;
  daily_calorie_target: number | null;
  weight_current: number | null;
  weight_goal: number | null;
  height_cm: number | null;
  age: number | null;
  other_sports: string[] | null;
  preferred_split: string | null;
  gender: string | null;
}

const SUGGESTIONS = [
  "This plan is too intense",
  "What should I eat tonight?",
  "Can I swap today's workout?",
  "Why is my protein so high?",
  "I feel tired today"
];

export default function Coach() {
  const { user } = useAuth();
  const { 
    checkForProfileUpdates, 
    triggerRegeneration,
    isRegenerating,
    regenerationType 
  } = useProfileUpdates();
  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    isLoadingSessions,
    isLoadingMessages,
    setIsLoading,
    selectSession,
    startNewChat,
    deleteSession,
    addUserMessage,
    startAssistantResponse,
    updateLastAssistantMessage,
    completeAssistantResponse,
  } = useChatSessions();
  
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as unknown as UserProfile);
    };
    fetchProfile();
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || isRegenerating || !user) return;

    setInput("");
    setIsLoading(true);
    
    // Add user message (saves to DB)
    await addUserMessage(messageText);

    // Check for profile updates / plan modifications FIRST
    const profileUpdateResult = await checkForProfileUpdates(messageText, user.id);

    // If this is an explicit plan modification request
    if (profileUpdateResult.planModification?.type) {
      startAssistantResponse();

      const regenResult = await triggerRegeneration(
        user.id,
        profileUpdateResult.needsMealRegeneration || false,
        profileUpdateResult.needsWorkoutRegeneration || false,
        {
          planModification: profileUpdateResult.planModification,
          weeklyActivities: profileUpdateResult.weeklyActivities,
        }
      );

      if (!regenResult.success) {
        const isRateLimited = regenResult.error?.toLowerCase().includes("limit") || 
                              regenResult.error?.toLowerCase().includes("429");
        const friendlyError = isRateLimited
          ? "You've reached your daily AI limit. Your current plan is still active — check back tomorrow for changes! 💪"
          : `I couldn't update your plan right now. ${regenResult.error ? `(${regenResult.error})` : "Please try again."}`;
        
        await completeAssistantResponse(friendlyError);
        setIsLoading(false);
        return;
      }

      // Success: refetch profile
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) setProfile(data as unknown as UserProfile);
      } catch (e) {
        console.error("Profile refetch error:", e);
      }

      const confirmation =
        profileUpdateResult.planModification.type === "meal"
          ? `Done — I updated today's meals to include ${profileUpdateResult.planModification.context || "your request"}. Check the Meals tab.`
          : "Done — I updated your workout plan. Check the Workouts tab.";

      await completeAssistantResponse(confirmation);
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session");
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: messages.slice(1).concat([{ role: "user" as const, content: messageText }]).map(m => ({
            role: m.role,
            content: m.content
          })),
          profile: profile
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          startAssistantResponse();
          const fallbackMessage = "I'm a bit busy right now! Give me a moment and try again. 🙏";
          await completeAssistantResponse(fallbackMessage);
          setIsLoading(false);
          return;
        }
        if (response.status === 402) {
          startAssistantResponse();
          const fallbackMessage = "You've hit your AI limit for today. Come back tomorrow for more coaching! 💪";
          await completeAssistantResponse(fallbackMessage);
          setIsLoading(false);
          return;
        }
        startAssistantResponse();
        const fallbackMessage = "I'm having a moment here. Could you try rephrasing that, or give me another shot in a few seconds? 🤔";
        await completeAssistantResponse(fallbackMessage);
        setIsLoading(false);
        return;
      }

      startAssistantResponse();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        let textBuffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            textBuffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
              let line = textBuffer.slice(0, newlineIndex);
              textBuffer = textBuffer.slice(newlineIndex + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                  updateLastAssistantMessage(assistantContent);
                }
              } catch {
                // Partial JSON, continue
              }
            }
          }
        } catch (streamError) {
          console.error("Stream error:", streamError);
          if (!assistantContent) {
            assistantContent = "I lost my train of thought there. Could you ask me again? 😅";
          }
        }
      }

      if (!assistantContent || assistantContent.trim() === "") {
        assistantContent = "I'm here to help! Could you tell me more about what you'd like to change or ask? 💪";
      }
      await completeAssistantResponse(assistantContent);

      setIsLoading(false);

      // Apply profile updates after AI response
      try {
        if (profileUpdateResult.hasUpdates) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (data) setProfile(data as unknown as UserProfile);

          if (profileUpdateResult.needsMealRegeneration || profileUpdateResult.needsWorkoutRegeneration) {
            await triggerRegeneration(
              user.id,
              profileUpdateResult.needsMealRegeneration || false,
              profileUpdateResult.needsWorkoutRegeneration || false,
              {
                weeklyActivities: profileUpdateResult.weeklyActivities,
              }
            );
          }
        }
      } catch (profileError) {
        console.error("Profile update error:", profileError);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      startAssistantResponse();
      const fallbackMessage = "Something went a bit sideways. Let's try that again — what's on your mind? 🤝";
      await completeAssistantResponse(fallbackMessage);
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const inputDisabled = isLoading || isRegenerating;

  // Show loading state while fetching
  if (isLoadingSessions && isLoadingMessages) {
    return (
      <AppLayout>
        <div className="dark flex flex-col h-[100dvh] bg-background items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading your conversation...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="dark flex h-[100dvh] bg-background overflow-hidden">
        {/* Chat History Sidebar - Slide over on mobile */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none",
            showHistory ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:hidden"
          )}
        >
          {showHistory && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50 lg:hidden"
                onClick={() => setShowHistory(false)}
              />
              <ChatHistorySidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={(id) => {
                  selectSession(id);
                  setShowHistory(false);
                }}
                onNewChat={() => {
                  startNewChat();
                  setShowHistory(false);
                }}
                onDeleteSession={deleteSession}
                onClose={() => setShowHistory(false)}
                isLoading={isLoadingSessions}
              />
            </>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
          {/* Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 pt-12 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setShowHistory(true)}
              >
                <History className="h-5 w-5" />
              </Button>
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-primary/30 rounded-full blur-md" />
                <div className="relative rounded-full bg-gradient-to-br from-primary to-primary/80 p-2.5">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground truncate">Your AI Coach</h1>
                <p className="text-sm text-muted-foreground truncate">Adjust your workouts and nutrition</p>
              </div>
            </div>
          </div>

          {/* Regeneration Banner */}
          {isRegenerating && (
            <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-primary/10 border-b border-primary/20 flex items-center gap-3">
              <RefreshCw className="h-4 w-4 animate-spin text-primary shrink-0" />
              <span className="text-sm text-primary font-medium truncate">
                {regenerationType === 'meal' && "Updating your meal plan..."}
                {regenerationType === 'workout' && "Updating your workout program..."}
                {regenerationType === 'both' && "Updating your plans..."}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage key={index} role={message.role} content={message.content} />
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <ChatMessage role="assistant" content="" isLoading />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions (only show when few messages and not loading) */}
          {messages.length <= 2 && !inputDisabled && (
            <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t border-border/50 bg-background/50">
              <p className="text-xs text-muted-foreground mb-3">Try saying:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(suggestion)}
                    disabled={inputDisabled}
                    className="text-xs bg-card hover:bg-accent border-border/50 text-foreground"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 p-4 border-t border-border pb-24 bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRegenerating ? "Coach is updating your plan..." : "Tell me what you want to change…"}
                className="flex-1 bg-card border-border text-foreground placeholder:text-muted-foreground"
                disabled={inputDisabled}
              />
              <Button
                type="submit"
                size="icon"
                className="gradient-primary shadow-lg shadow-primary/25 shrink-0"
                disabled={!input.trim() || inputDisabled}
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
