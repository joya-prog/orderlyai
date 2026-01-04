import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Template } from "@shared/schema";
import { 
  Plus, 
  LayoutTemplate, 
  ArrowLeft, 
  Phone, 
  UtensilsCrossed,
  Calendar,
  MessageSquare,
  ClipboardList,
  X
} from "lucide-react";

type DialogStep = "choice" | "templates" | "detail";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESTAURANT_TEMPLATES = [
  {
    id: "reservation-agent",
    name: "Reservation Agent",
    description: "Handle table reservations, check availability, manage booking details, and send confirmation messages. Perfect for restaurants that take phone reservations.",
    industry: "restaurant",
    icon: Calendar,
    greetingMessage: "Thank you for calling! I'm here to help you with your reservation. How may I assist you today?",
    personality: "Professional, warm, and efficient. Speaks clearly and confirms details accurately.",
    systemPrompt: "You are a professional restaurant reservation agent. Help callers book tables, check availability, modify existing reservations, and answer questions about the restaurant. Always confirm reservation details including date, time, party size, and contact information.",
  },
  {
    id: "order-taking-agent",
    name: "Order Taking Agent",
    description: "Take phone orders for pickup or delivery, handle menu inquiries, process special requests, and provide order confirmations. Ideal for takeout-focused restaurants.",
    industry: "restaurant",
    icon: ClipboardList,
    greetingMessage: "Hello! Thank you for calling. I'm ready to take your order. What can I get for you today?",
    personality: "Friendly, patient, and detail-oriented. Repeats orders back to ensure accuracy.",
    systemPrompt: "You are a restaurant order-taking agent. Help callers place orders for pickup or delivery. Know the menu well, handle modifications and special requests, confirm order details and estimated wait times, and collect necessary contact information.",
  },
  {
    id: "general-inquiries-agent",
    name: "General Inquiries Agent",
    description: "Answer common questions about hours, location, menu items, dietary options, and policies. Great for reducing routine calls to staff.",
    industry: "restaurant",
    icon: MessageSquare,
    greetingMessage: "Hi there! Thank you for calling. I'm happy to help answer any questions about our restaurant.",
    personality: "Helpful, knowledgeable, and conversational. Provides thorough answers while being concise.",
    systemPrompt: "You are a helpful restaurant assistant. Answer questions about business hours, location and directions, menu items and pricing, dietary accommodations, parking, dress code, and other common inquiries. If you cannot answer a question, offer to transfer to a staff member.",
  },
  {
    id: "catering-agent",
    name: "Catering & Events Agent",
    description: "Handle catering inquiries, discuss event options, collect event details, and schedule follow-up calls with the catering team.",
    industry: "restaurant",
    icon: UtensilsCrossed,
    greetingMessage: "Thank you for calling about our catering services! I'd love to help you plan your event.",
    personality: "Enthusiastic, organized, and consultative. Asks thoughtful questions about event needs.",
    systemPrompt: "You are a catering and events specialist. Help callers explore catering options for their events. Gather details about event date, guest count, venue, dietary requirements, and budget. Explain available packages and menu options. Schedule callbacks with the catering team for detailed planning.",
  },
];

export function CreateAgentDialog({ open, onOpenChange }: CreateAgentDialogProps) {
  const [step, setStep] = useState<DialogStep>("choice");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof RESTAURANT_TEMPLATES[0] | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: dbTemplates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: open && step === "templates",
  });

  const installMutation = useMutation({
    mutationFn: async (template: typeof RESTAURANT_TEMPLATES[0]) => {
      const response = await apiRequest("POST", "/api/agents", {
        name: template.name,
        description: template.description,
        industry: template.industry,
        greetingMessage: template.greetingMessage,
        personality: template.personality,
        systemPrompt: template.systemPrompt,
        status: "draft",
      });
      return response.json();
    },
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Template Installed",
        description: "Your new agent has been created from the template.",
      });
      handleClose();
      setLocation(`/agents/${agent.id}`);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create agent from template.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setStep("choice");
    setSelectedTemplate(null);
    onOpenChange(false);
  };

  const handleStartFromScratch = () => {
    handleClose();
    setLocation("/agents/new");
  };

  const handleSelectTemplate = (template: typeof RESTAURANT_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setStep("detail");
  };

  const handleInstallTemplate = () => {
    if (selectedTemplate) {
      installMutation.mutate(selectedTemplate);
    }
  };

  const handleBackToTemplates = () => {
    setSelectedTemplate(null);
    setStep("templates");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        {step === "choice" && (
          <>
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-semibold">Create New Agent</DialogTitle>
              </div>
            </DialogHeader>
            <div className="p-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className="cursor-pointer hover-elevate transition-all border-2 hover:border-primary/50"
                  onClick={handleStartFromScratch}
                  data-testid="card-start-from-scratch"
                >
                  <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">Start from Scratch</h3>
                    <p className="text-sm text-muted-foreground">
                      Build your AI Agent from the ground up
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover-elevate transition-all border-2 hover:border-primary/50"
                  onClick={() => setStep("templates")}
                  data-testid="card-browse-templates"
                >
                  <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                      <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">Browse our Templates</h3>
                    <p className="text-sm text-muted-foreground">
                      Get inspired by our templates to get started
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {step === "templates" && (
          <>
            <DialogHeader className="p-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setStep("choice")}
                  data-testid="button-back-to-choice"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-lg font-semibold">Select Template</DialogTitle>
              </div>
            </DialogHeader>
            <div className="p-6 max-h-[400px] overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="gap-1.5">
                  <Phone className="h-3 w-3" />
                  Inbound
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <UtensilsCrossed className="h-3 w-3" />
                  Restaurant
                </Badge>
              </div>
              <div className="grid gap-3">
                {RESTAURANT_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover-elevate transition-all border hover:border-primary/50"
                      onClick={() => handleSelectTemplate(template)}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{template.name}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {step === "detail" && selectedTemplate && (
          <>
            <DialogHeader className="p-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBackToTemplates}
                  data-testid="button-back-to-templates"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-lg font-semibold">Back to Templates</DialogTitle>
              </div>
            </DialogHeader>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <selectedTemplate.icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">{selectedTemplate.name}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <UtensilsCrossed className="h-3 w-3" />
                      Restaurant
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Phone className="h-3 w-3" />
                      Inbound
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {selectedTemplate.description}
                </p>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleInstallTemplate}
                  disabled={installMutation.isPending}
                  data-testid="button-install-template"
                >
                  {installMutation.isPending ? "Installing..." : "Install Template"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
