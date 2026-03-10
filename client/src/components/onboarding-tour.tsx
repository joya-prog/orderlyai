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
      overlayColor: "rgba(0,0,0,0.55)",
      smoothScroll: true,
      allowClose: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Let's go!",
      onDestroyStarted: () => {
        driverObj.destroy();
        completeTourMutation.mutate();
      },
      steps: [
        {
          popover: {
            title: "Welcome to Orderly AI",
            description: "Let's take a quick tour to get you set up. Your AI voice agent platform for restaurants is ready to use.",
            side: "over" as any,
            align: "center",
          },
        },
        {
          element: "[data-testid='nav-analytics']",
          popover: {
            title: "Analytics",
            description: "Track your call performance, revenue impact, and customer satisfaction scores in real time.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-agents']",
          popover: {
            title: "Voice Agents",
            description: "Create and configure your AI voice agents here. Each agent can have its own personality, voice, and knowledge base.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-knowledge base']",
          popover: {
            title: "Knowledge Base",
            description: "Train your agents with your restaurant's FAQs, menus, hours, and policies so they can answer customer questions accurately.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-phone numbers']",
          popover: {
            title: "Phone Numbers",
            description: "Search for and purchase a phone number, then assign it to your agent so customers can call in.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='nav-templates']",
          popover: {
            title: "Templates",
            description: "Don't start from scratch — use one of our pre-built templates for fine dining, casual restaurants, catering, and hotels.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "[data-testid='credit-widget-trigger']",
          popover: {
            title: "Trial Credit",
            description: "You have $10 in trial credit to test your voice agent. Once it runs out, add a payment method to keep going — you only pay for what you use.",
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
