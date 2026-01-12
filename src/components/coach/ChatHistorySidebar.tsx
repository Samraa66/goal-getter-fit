import { useState } from "react";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Plus, 
  ChevronLeft, 
  Trash2, 
  MoreHorizontal,
  History,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
}

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

function groupSessionsByDate(sessions: ChatSession[]) {
  const groups: Record<string, ChatSession[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  sessions.forEach((session) => {
    const date = new Date(session.last_message_at || session.created_at);
    if (isToday(date)) {
      groups.today.push(session);
    } else if (isYesterday(date)) {
      groups.yesterday.push(session);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(session);
    } else if (isThisMonth(date)) {
      groups.thisMonth.push(session);
    } else {
      groups.older.push(session);
    }
  });

  return groups;
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClose,
  isLoading,
}: ChatHistorySidebarProps) {
  const groupedSessions = groupSessionsByDate(sessions);

  const renderGroup = (label: string, groupSessions: ChatSession[]) => {
    if (groupSessions.length === 0) return null;

    return (
      <div className="mb-4">
        <p className="text-xs text-muted-foreground font-medium px-3 mb-2">{label}</p>
        <div className="space-y-1">
          {groupSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                currentSessionId === session.id
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-muted text-foreground"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-sm truncate">{session.title}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border w-72">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Chat History</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-border">
        <Button
          onClick={onNewChat}
          className="w-full gradient-primary"
          disabled={isLoading}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          <>
            {renderGroup("Today", groupedSessions.today)}
            {renderGroup("Yesterday", groupedSessions.yesterday)}
            {renderGroup("This Week", groupedSessions.thisWeek)}
            {renderGroup("This Month", groupedSessions.thisMonth)}
            {renderGroup("Older", groupedSessions.older)}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
