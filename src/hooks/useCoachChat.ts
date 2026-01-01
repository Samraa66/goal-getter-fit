import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Hey! I'm your Forme Coach. Tell me what's going on this week and I'll adjust your plan."
};

export function useCoachChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Load chat history from database
  const loadChatHistory = useCallback(async () => {
    if (!user) {
      setIsLoadingHistory(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading chat history:", error);
        setIsLoadingHistory(false);
        return;
      }

      if (data && data.length > 0) {
        // Map DB records to Message format
        const loadedMessages: Message[] = data.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          created_at: msg.created_at || undefined,
        }));
        setMessages([WELCOME_MESSAGE, ...loadedMessages]);
      } else {
        // No history, just show welcome message
        setMessages([WELCOME_MESSAGE]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  // Save a message to the database
  const saveMessage = useCallback(async (message: Message): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          role: message.role,
          content: message.content,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error saving message:", error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  }, [user]);

  // Add a user message (saves to DB and updates state)
  const addUserMessage = useCallback(async (content: string): Promise<void> => {
    const userMessage: Message = {
      role: "user",
      content,
    };

    // Update state immediately for responsiveness
    setMessages((prev) => [...prev, userMessage]);

    // Save to database
    await saveMessage(userMessage);
  }, [saveMessage]);

  // Add an assistant message (saves to DB and updates state)
  const addAssistantMessage = useCallback(async (content: string): Promise<void> => {
    const assistantMessage: Message = {
      role: "assistant",
      content,
    };

    // Update state
    setMessages((prev) => [...prev, assistantMessage]);

    // Save to database
    await saveMessage(assistantMessage);
  }, [saveMessage]);

  // Update the last assistant message (for streaming) - doesn't save until complete
  const updateLastAssistantMessage = useCallback((content: string): void => {
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content,
        };
      }
      return updated;
    });
  }, []);

  // Start streaming response (adds empty assistant message)
  const startAssistantResponse = useCallback((): void => {
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
  }, []);

  // Complete streaming response (saves to DB)
  const completeAssistantResponse = useCallback(async (content: string): Promise<void> => {
    // Update the last message with final content
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content,
        };
      }
      return updated;
    });

    // Save to database
    await saveMessage({ role: "assistant", content });
  }, [saveMessage]);

  // Remove the last message (for error recovery)
  const removeLastMessage = useCallback((): void => {
    setMessages((prev) => prev.slice(0, -1));
  }, []);

  // Clear all chat history
  const clearHistory = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await supabase
        .from("chat_messages")
        .delete()
        .eq("user_id", user.id);

      setMessages([WELCOME_MESSAGE]);
    } catch (error) {
      console.error("Error clearing chat history:", error);
    }
  }, [user]);

  // Load history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    setIsLoading,
    addUserMessage,
    addAssistantMessage,
    startAssistantResponse,
    updateLastAssistantMessage,
    completeAssistantResponse,
    removeLastMessage,
    clearHistory,
    refetch: loadChatHistory,
  };
}
