import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfileUpdates } from "@/hooks/useProfileUpdates";
import { useCoachChat } from "@/hooks/useCoachChat";

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

const WELCOME_MESSAGE = `Hey! I'm your Forme Coach. Tell me what's going on this week and I'll adjust your plan.`;

export default function Coach() {
  const { user } = useAuth();
  const { 
    checkForProfileUpdates, 
    triggerRegeneration,
    isRegenerating,
    regenerationType 
  } = useProfileUpdates();
  const {
    messages,
    isLoading,
    isLoadingHistory,
    setIsLoading,
    addUserMessage,
    startAssistantResponse,
    updateLastAssistantMessage,
    completeAssistantResponse,
    removeLastMessage,
  } = useCoachChat();
  
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

    // Check for profile updates / plan modifications FIRST (so we don't "promise" changes that fail)
    const profileUpdateResult = await checkForProfileUpdates(messageText, user.id);

    // If this is an explicit plan modification request, apply it authoritatively and respond only on success.
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
        await completeAssistantResponse(
          `I couldn't update your plan yet. ${regenResult.error ? `(${regenResult.error})` : "Please try again."}`
        );
        setIsLoading(false);
        return;
      }

      // Success: refetch profile (in case the message also contained profile updates)
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
      // Get the current session token for authentication
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
          // Rate limited - show friendly fallback
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
        // Other errors - provide graceful fallback
        startAssistantResponse();
        const fallbackMessage = "I'm having a moment here. Could you try rephrasing that, or give me another shot in a few seconds? 🤔";
        await completeAssistantResponse(fallbackMessage);
        setIsLoading(false);
        return;
      }

      // Start streaming response (adds empty assistant message to state)
      startAssistantResponse();

      // Handle streaming response
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
          // If streaming fails but we have some content, use it
          if (!assistantContent) {
            assistantContent = "I lost my train of thought there. Could you ask me again? 😅";
          }
        }
      }

      // Complete the response (saves to DB)
      // If no content was received, provide a fallback
      if (!assistantContent || assistantContent.trim() === "") {
        assistantContent = "I'm here to help! Could you tell me more about what you'd like to change or ask? 💪";
      }
      await completeAssistantResponse(assistantContent);

      setIsLoading(false);

      // Apply profile updates / regenerations AFTER AI response (non-plan-modification cases)
      try {
        if (profileUpdateResult.hasUpdates) {
          // Refetch profile to get updated data
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (data) setProfile(data as unknown as UserProfile);

          // Trigger regeneration if needed
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
        // Don't fail the whole message for profile updates
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Graceful degradation - still show a message instead of toast error
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

  // Determine if input should be disabled
  const inputDisabled = isLoading || isRegenerating;

  // Show loading state while fetching chat history
  if (isLoadingHistory) {
    return (
      <AppLayout>
        <div className="dark flex flex-col h-screen bg-background items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading your conversation...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="dark flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="px-6 pt-12 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-md" />
              <div className="relative rounded-full bg-gradient-to-br from-primary to-primary/80 p-2.5">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Your AI Coach</h1>
              <p className="text-sm text-muted-foreground">Adjust your workouts and nutrition for this week</p>
            </div>
          </div>
        </div>

        {/* Regeneration Banner */}
        {isRegenerating && (
          <div className="px-6 py-3 bg-primary/10 border-b border-primary/20 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-primary font-medium">
              {regenerationType === 'meal' && "Updating your meal plan..."}
              {regenerationType === 'workout' && "Updating your workout program..."}
              {regenerationType === 'both' && "Updating your plans..."}
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide text-destructive-foreground">
          {messages.map((message, index) => (
            <ChatMessage key={index} role={message.role} content={message.content} />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <ChatMessage role="assistant" content="" isLoading />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions (only show when few messages and not loading) */}
        {messages.length <= 2 && !inputDisabled && (
          <div className="px-6 py-3 border-t border-border/50 bg-background/50">
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
        <div className="p-4 border-t border-border pb-24 bg-background">
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
              className="gradient-primary shadow-lg shadow-primary/25"
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
    </AppLayout>
  );
}
