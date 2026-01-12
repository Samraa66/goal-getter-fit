import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  session_id?: string;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Hey! I'm your Forme Coach. Tell me what's going on this week and I'll adjust your plan."
};

export function useChatSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Fetch all sessions for the user
  const fetchSessions = useCallback(async () => {
    if (!user) {
      setIsLoadingSessions(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      setSessions((data as ChatSession[]) || []);

      // If there are sessions and no current session, select the most recent one
      if (data && data.length > 0 && !currentSessionId) {
        setCurrentSessionId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [user, currentSessionId]);

  // Fetch messages for a specific session
  const fetchMessages = useCallback(async (sessionId: string) => {
    if (!user) return;

    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = (data || []).map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        created_at: msg.created_at || undefined,
        session_id: msg.session_id || undefined,
      }));

      setMessages([WELCOME_MESSAGE, ...loadedMessages]);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([WELCOME_MESSAGE]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user]);

  // Create a new chat session
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: "New Chat",
        })
        .select("id")
        .single();

      if (error) throw error;

      const newSessionId = data.id;
      
      // Refresh sessions list
      await fetchSessions();
      
      // Set as current session
      setCurrentSessionId(newSessionId);
      setMessages([WELCOME_MESSAGE]);

      return newSessionId;
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }
  }, [user, fetchSessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      // Refresh sessions
      await fetchSessions();

      // If we deleted the current session, switch to most recent or create new
      if (currentSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          setCurrentSessionId(null);
          setMessages([WELCOME_MESSAGE]);
        }
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  }, [user, currentSessionId, sessions, fetchSessions]);

  // Select a session
  const selectSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    await fetchMessages(sessionId);
  }, [fetchMessages]);

  // Update session title based on first user message
  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    if (!user) return;

    try {
      // Truncate title to 50 characters
      const truncatedTitle = title.length > 50 ? title.substring(0, 47) + "..." : title;
      
      await supabase
        .from("chat_sessions")
        .update({ title: truncatedTitle })
        .eq("id", sessionId);

      // Update local state
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: truncatedTitle } : s))
      );
    } catch (error) {
      console.error("Error updating session title:", error);
    }
  }, [user]);

  // Save a message to the current session
  const saveMessage = useCallback(async (message: Message): Promise<string | null> => {
    if (!user) return null;

    let sessionId = currentSessionId;

    // If no current session, create one
    if (!sessionId) {
      sessionId = await createSession();
      if (!sessionId) return null;
    }

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          session_id: sessionId,
          role: message.role,
          content: message.content,
        })
        .select("id")
        .single();

      if (error) throw error;

      // If this is the first user message, update session title
      if (message.role === "user" && messages.length <= 1) {
        await updateSessionTitle(sessionId, message.content);
      }

      // Refresh sessions to update last_message_at
      await fetchSessions();

      return data?.id || null;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  }, [user, currentSessionId, messages.length, createSession, updateSessionTitle, fetchSessions]);

  // Add user message
  const addUserMessage = useCallback(async (content: string) => {
    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    await saveMessage(userMessage);
  }, [saveMessage]);

  // Start assistant response (streaming)
  const startAssistantResponse = useCallback(() => {
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
  }, []);

  // Update last assistant message (streaming)
  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
        updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      }
      return updated;
    });
  }, []);

  // Complete assistant response
  const completeAssistantResponse = useCallback(async (content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
        updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      }
      return updated;
    });
    await saveMessage({ role: "assistant", content });
  }, [saveMessage]);

  // Start new chat
  const startNewChat = useCallback(async () => {
    const newSessionId = await createSession();
    return newSessionId;
  }, [createSession]);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId, fetchMessages]);

  return {
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
    fetchSessions,
  };
}
