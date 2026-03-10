import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, LifeBuoy, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { SupportMessage } from "@shared/schema";

interface HelpChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpChat({ open, onOpenChange }: HelpChatProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/messages"],
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/support/unread-count"],
    refetchInterval: 60000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", "/api/support/messages", { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages"] });
      setInputValue("");
    },
  });

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || sendMutation.isPending) return;
    sendMutation.mutate(inputValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <div className="relative">
        {unreadCount > 0 && !open && (
          <Badge
            className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white no-default-active-elevate z-10 min-w-4"
            data-testid="badge-unread-messages"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[420px] flex flex-col p-0" data-testid="help-chat-sheet">
          <SheetHeader className="px-4 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LifeBuoy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">Help & Support</SheetTitle>
                <p className="text-xs text-muted-foreground">Chat with the Orderly AI team</p>
              </div>
            </div>
          </SheetHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            data-testid="chat-messages-container"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
                <div className="p-4 rounded-full bg-muted">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">No messages yet</p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Send a message and the Orderly AI team will get back to you as soon as possible.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.senderRole === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  {msg.senderRole === "admin" && (
                    <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.senderRole === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.senderRole === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                  {msg.senderRole === "user" && (
                    <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-muted">
                        {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t bg-background">
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none min-h-[60px] max-h-[120px] text-sm"
                rows={2}
                data-testid="input-chat-message"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Press Enter to send, Shift+Enter for new line</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function useUnreadSupportCount() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/support/unread-count"],
    refetchInterval: 60000,
  });
  return data?.count ?? 0;
}
