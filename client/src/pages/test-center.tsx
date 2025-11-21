import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send } from "lucide-react";

export default function TestCenterPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: isAuthenticated,
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const testMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest("POST", `/api/agents/${selectedAgentId}/test`, {
        message: userMessage,
        history: messages,
      });
      return response;
    },
    onSuccess: (data: { response: string }) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      setInput("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to get response from agent",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    testMutation.mutate(input);
  };

  if (authLoading || agentsLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-semibold font-serif mb-6">Test Center</h1>
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
              <p className="text-muted-foreground">
                Create an agent first before testing conversations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedAgentId && agents.length > 0) {
    setSelectedAgentId(agents[0].id);
    return null;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold font-serif">Test Center</h1>
          <p className="text-muted-foreground mt-1">
            Test your agents with real conversations
          </p>
        </div>
        <div className="w-64">
          <Select value={selectedAgentId} onValueChange={(value) => {
            setSelectedAgentId(value);
            setMessages([]);
          }}>
            <SelectTrigger data-testid="select-agent">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation with {selectedAgent?.name}</CardTitle>
          <CardDescription>
            Have a conversation with your agent to test its responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-2xl p-4 min-h-[400px] max-h-[500px] overflow-y-auto bg-muted/30">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start a conversation to test your agent</p>
                    <p className="text-sm mt-2">
                      The agent will use the greeting, personality, and knowledge you've configured
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        }`}
                        data-testid={`message-${msg.role}-${i}`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {testMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-card border rounded-2xl px-4 py-2">
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                disabled={testMutation.isPending}
                data-testid="input-test-message"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || testMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {messages.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setMessages([])}
                data-testid="button-clear-conversation"
              >
                Clear Conversation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
