import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Loader2 } from "lucide-react";
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
}

const SUGGESTIONS = [
  "What should I eat for dinner?",
  "I prefer Push/Pull/Legs split",
  "I have a football match this week",
  "This workout plan is too intense"
];

export default function Coach() {
  const { user } = useAuth();
  const { checkForProfileUpdates, triggerRegeneration } = useProfileUpdates();
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
    if (!messageText.trim() || isLoading || !user) return;

    setInput("");
    setIsLoading(true);
    
    // Add user message (saves to DB)
    await addUserMessage(messageText);
    
    // Check for profile updates in the background
    checkForProfileUpdates(messageText, user.id).then(async (result) => {
      if (result.hasUpdates) {
        // Refetch profile to get updated data
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) setProfile(data as unknown as UserProfile);
        
        // Trigger regeneration if needed
        if (result.needsMealRegeneration || result.needsWorkoutRegeneration) {
          await triggerRegeneration(
            user.id,
            result.needsMealRegeneration || false,
            result.needsWorkoutRegeneration || false
          );
        }
      }
    });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
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
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }
        if (response.status === 402) {
          throw new Error("Usage limit reached. Please try again later.");
        }
        throw new Error("Failed to get response");
      }

      // Start streaming response (adds empty assistant message to state)
      startAssistantResponse();

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        let textBuffer = "";
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
      }

      // Complete the response (saves to DB)
      if (assistantContent) {
        await completeAssistantResponse(assistantContent);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      });
      removeLastMessage(); // Remove the loading/empty message
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

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
            <div className="rounded-full bg-primary p-2">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Forme Coach</h1>
              <p className="text-sm text-muted-foreground">Adaptive coaching for your week</p>
            </div>
          </div>
        </div>

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

        {/* Suggestions (only show when few messages) */}
        {messages.length <= 2 && (
          <div className="px-6 py-2">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(suggestion)}
                  disabled={isLoading}
                  className="text-xs text-secondary-foreground"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border pb-24">
          <form onSubmit={handleSubmit} className="flex gap-2 text-secondary-foreground">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Talk to your coach..."
              className="flex-1 bg-card"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="gradient-primary"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
