import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Phone, Clock, DollarSign, MessageSquare, Users } from "lucide-react";
import { useLocation } from "wouter";
import type { SupportMessage, User } from "@shared/schema";

interface SupportThread {
  userId: string;
  lastMessage: SupportMessage;
  unreadCount: number;
  user: Pick<User, "id" | "email" | "firstName" | "lastName" | "restaurantName" | "profileImageUrl">;
}

interface ThreadDetail {
  user: User;
  messages: SupportMessage[];
  stats: { totalCalls: number; totalMinutes: number; totalCostCents: number; agentsCount: number };
}

function getInitials(u: Pick<User, "firstName" | "lastName" | "email">) {
  if (u.firstName || u.lastName) return `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase();
  return u.email?.[0]?.toUpperCase() || "?";
}

function formatTimeAgo(date: string | Date | null) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function AdminSupport() {
  const [, navigate] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: threads = [], isLoading } = useQuery<SupportThread[]>({
    queryKey: ["/api/admin/support"],
    refetchInterval: 30000,
  });

  const { data: threadDetail, refetch: refetchThread } = useQuery<ThreadDetail>({
    queryKey: ["/api/admin/support", selectedUserId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/support/${selectedUserId}`);
      if (!res.ok) throw new Error("Failed to fetch thread");
      return res.json();
    },
    enabled: !!selectedUserId,
    refetchInterval: selectedUserId ? 15000 : false,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/admin/support/${selectedUserId}/reply`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support"] });
      setReplyText("");
      refetchThread();
    },
  });

  const handleReply = () => {
    if (!replyText.trim() || replyMutation.isPending) return;
    replyMutation.mutate(replyText.trim());
  };

  const totalUnread = threads.reduce((acc, t) => acc + t.unreadCount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/restaurants")} data-testid="button-back-admin">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Support Inbox
            {totalUnread > 0 && (
              <Badge className="bg-red-500 text-white no-default-active-elevate" data-testid="badge-total-unread">
                {totalUnread} unread
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Respond to user help requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Thread list */}
        <Card className="md:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {threads.length} conversation{threads.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
            ) : threads.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <MessageSquare className="h-8 w-8 opacity-40" />
                <p>No support messages yet</p>
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.userId}
                  className={`w-full text-left px-4 py-3 border-b last:border-0 hover-elevate transition-colors ${selectedUserId === thread.userId ? "bg-primary/5" : ""}`}
                  onClick={() => setSelectedUserId(thread.userId)}
                  data-testid={`thread-item-${thread.userId}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={thread.user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs bg-muted">{getInitials(thread.user)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">
                          {thread.user.restaurantName || thread.user.firstName || thread.user.email}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatTimeAgo(thread.lastMessage.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{thread.lastMessage.content}</p>
                      {thread.unreadCount > 0 && (
                        <Badge className="mt-1 bg-red-500 text-white text-[10px] h-4 px-1.5 no-default-active-elevate" data-testid={`badge-unread-${thread.userId}`}>
                          {thread.unreadCount} new
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Thread detail + reply */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {!selectedUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
              <div className="p-4 rounded-full bg-muted">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm text-muted-foreground">Choose a user from the left to view their messages</p>
            </div>
          ) : threadDetail ? (
            <>
              {/* Thread header */}
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={threadDetail.user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs bg-muted">{getInitials(threadDetail.user)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {threadDetail.user.restaurantName || `${threadDetail.user.firstName || ""} ${threadDetail.user.lastName || ""}`.trim() || threadDetail.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{threadDetail.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{threadDetail.stats.totalCalls} calls</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{threadDetail.stats.totalMinutes.toFixed(1)} min</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      <span>${(threadDetail.stats.totalCostCents / 100).toFixed(2)} spent</span>
                    </div>
                    <Badge variant="outline" className="text-xs no-default-active-elevate">
                      {threadDetail.stats.agentsCount} agent{threadDetail.stats.agentsCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3" data-testid="admin-messages-container">
                {threadDetail.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.senderRole === "admin" ? "justify-end" : "justify-start"}`}
                    data-testid={`admin-message-${msg.id}`}
                  >
                    {msg.senderRole === "user" && (
                      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-muted">{getInitials(threadDetail.user)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        msg.senderRole === "admin"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.senderRole === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                    {msg.senderRole === "admin" && (
                      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">You</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="px-4 py-3 border-t flex-shrink-0 bg-background">
                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder="Type a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                    className="resize-none min-h-[60px] max-h-[120px] text-sm"
                    rows={2}
                    data-testid="input-admin-reply"
                  />
                  <Button
                    size="icon"
                    onClick={handleReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    data-testid="button-send-reply"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Enter to send, Shift+Enter for new line</p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          )}
        </Card>
      </div>
    </div>
  );
}
