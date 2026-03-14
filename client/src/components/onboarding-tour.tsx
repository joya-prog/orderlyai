import { useEffect, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OnboardingTourProps {
  autoStart?: boolean;
  onComplete?: () => void;
}

export function useOnboardingTour(onComplete?: () => void) {
  const completeTourMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/tour"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onComplete?.();
    },
  });

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(15, 23, 42, 0.65)",
      overlayOpacity: 1,
      smoothScroll: true,
      allowClose: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Let's go!",
      popoverClass: "orderly-tour-popover",
      onDestroyStarted: () => {
        driverObj.destroy();
        completeTourMutation.mutate();
      },
      steps: [
        {
          popover: {
            title: "Welcome to Orderly AI",
            description: "You're all set up! Let's take a quick tour to show you around your new voice agent platform.",
            side: "over" as any,
            align: "center",
          },
        },
        {
          element: "[data-testid='nav-analytics']",
          popover: {
            title: "Analytics Dashboard",
            description: "Monitor your call performance in real time — total calls, minutes used, revenue impact, and customer satisfaction all in one place.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-agents']",
          popover: {
            title: "Voice Agents",
            description: "Create and manage AI voice agents here. Each agent has its own voice, personality, and conversation flow tailored to your restaurant.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-knowledge base']",
          popover: {
            title: "Knowledge Base",
            description: "Train your agents with menus, hours, FAQs, and policies — so they can answer customer questions accurately without involving staff.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-phone numbers']",
          popover: {
            title: "Phone Numbers",
            description: "Search for and purchase a phone number, then assign it to an agent so customers can call in and be handled by AI.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-templates']",
          popover: {
            title: "Ready-Made Templates",
            description: "Don't start from scratch — pick a template for reservations, order-taking, general inquiries, or catering to get up and running in seconds.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='credit-widget-trigger']",
          popover: {
            title: "Your Trial Credit",
            description: "You have $10 in free trial credit to test your agents. You only pay for what you use — no monthly fees.",
            side: "right",
            align: "start",
          },
        },
      ],
    });

    driverObj.drive();
  }, [completeTourMutation]);

  return { startTour };
}

export function useWorkflowTour() {
  const startWorkflowTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(15, 23, 42, 0.65)",
      overlayOpacity: 1,
      smoothScroll: true,
      allowClose: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start Building!",
      popoverClass: "orderly-tour-popover",
      onDestroyStarted: () => {
        driverObj.destroy();
        localStorage.setItem("workflowTourSeen", "true");
      },
      steps: [
        {
          popover: {
            title: "Visual Workflow Builder",
            description: "Design how your AI agent handles conversations — step by step, without writing any code. This is where the magic happens.",
            side: "over" as any,
            align: "center",
          },
        },
        {
          element: "[data-testid='node-library-panel']",
          popover: {
            title: "Node Library",
            description: "Browse all available node types here — Greeting, Response, Condition, Transfer, and more. Each node represents a step in your conversation flow.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='flow-canvas']",
          popover: {
            title: "Drag & Drop Canvas",
            description: "Drag nodes from the library and drop them onto this canvas to build your flow. Then connect them together by drawing lines between the dots on each node.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "[data-testid='flow-canvas']",
          popover: {
            title: "Edit Node Properties",
            description: "Click any node on the canvas to open its settings panel on the right. You can edit the node's label, content, and add conditional transitions to control the conversation path.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "[data-testid='button-save-flow']",
          popover: {
            title: "Save Your Flow",
            description: "When you're happy with your conversation design, click Save to apply it to your agent. Your agent will use this flow in all future calls.",
            side: "left",
            align: "start",
          },
        },
      ],
    });

    driverObj.drive();
  }, []);

  return { startWorkflowTour };
}

export function useAgentEditorTour() {
  const startAgentEditorTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(15, 23, 42, 0.65)",
      overlayOpacity: 1,
      smoothScroll: true,
      allowClose: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start Building!",
      popoverClass: "orderly-tour-popover",
      onDestroyStarted: () => {
        driverObj.destroy();
        localStorage.setItem("agentEditorTourSeen", "true");
      },
      steps: [
        {
          popover: {
            title: "Your Agent's Flow Builder",
            description: "This is where you design how your AI agent handles every call — visually, without any code. Let's take a quick look around.",
            side: "over" as any,
            align: "center",
          },
        },
        {
          element: "[data-testid='agent-settings-panel']",
          popover: {
            title: "Global Settings",
            description: "Configure your agent's voice, language, AI model, and behavior here. You can also attach knowledge bases so your agent knows your menu, hours, and policies.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nodes-library-panel']",
          popover: {
            title: "Node Library",
            description: "These are the building blocks of your conversation. Drag any node — like a Greeting, Collect Input, or Transfer — onto the canvas to add it to your flow.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "[data-testid='flow-canvas']",
          popover: {
            title: "Flow Canvas",
            description: "Drop nodes here to build your conversation. Connect them by dragging from one node's output dot to another's input. The flow determines exactly what your agent says and does on every call.",
            side: "over" as any,
            align: "center",
          },
        },
        {
          element: "[data-testid='button-publish']",
          popover: {
            title: "Save & Publish",
            description: "When you're happy with your flow and settings, hit Save to apply the changes. Your agent will use this configuration on the next call it handles.",
            side: "bottom",
            align: "end",
          },
        },
      ],
    });

    driverObj.drive();
  }, []);

  return { startAgentEditorTour };
}

export function OnboardingTour({ autoStart = false, onComplete }: OnboardingTourProps) {
  const { startTour } = useOnboardingTour(onComplete);

  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => {
      startTour();
    }, 1200);
    return () => clearTimeout(timer);
  }, [autoStart, startTour]);

  return null;
}
