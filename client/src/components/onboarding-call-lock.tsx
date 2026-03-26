import { CalendarDays, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";
import type { User } from "@shared/schema";

// TODO: Replace this with your actual Calendly URL
const CALENDLY_URL = "https://calendly.com/orderly-ai/setup";

interface OnboardingCallLockProps {
  user: User;
}

export function OnboardingCallLock({ user }: OnboardingCallLockProps) {
  function openCalendly() {
    window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="onboarding-call-lock"
    >
      <div className="relative w-full max-w-lg mx-4">
        {/* Card */}
        <div className="rounded-2xl bg-background border border-border/40 shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          <div className="p-8">
            {/* Logo + restaurant name row */}
            <div className="flex items-center justify-between mb-8">
              <img
                src={orderlyLogo}
                alt="Orderly AI"
                className="w-10 h-10 rounded-lg object-contain"
                data-testid="img-lock-logo"
              />
              {user.restaurantName && (
                <span
                  className="text-xs text-muted-foreground font-medium"
                  data-testid="text-lock-restaurant-name"
                >
                  {user.restaurantName}
                </span>
              )}
            </div>

            {/* Calendar icon with pulse */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CalendarDays className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>

            {/* Heading */}
            <h1
              className="text-2xl font-bold text-center text-foreground mb-3"
              data-testid="heading-lock"
            >
              Welcome to Orderly AI
            </h1>
            <p className="text-center text-foreground font-medium mb-4">
              Let's get you set up properly.
            </p>

            {/* Body */}
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-8">
              Setting up your AI phone agent involves configuring phone numbers, AI voice and
              behavior, POS integrations, and live call testing. To make sure everything works
              perfectly for your restaurant, every new account is onboarded 1:1 with an Orderly
              team member. Book your free setup call below — it takes about 30 minutes.
            </p>

            {/* CTA */}
            <Button
              size="lg"
              className="w-full gap-2 text-base"
              onClick={openCalendly}
              data-testid="button-book-call"
            >
              <CalendarDays className="h-5 w-5" />
              Book your setup call
              <ExternalLink className="h-4 w-4 opacity-70" />
            </Button>

            {/* Footer note */}
            <p
              className="text-xs text-muted-foreground text-center mt-5 leading-relaxed"
              data-testid="text-lock-footer"
            >
              After your call, your account manager will unlock your dashboard.
              <br />
              Questions?{" "}
              <a
                href="mailto:hello@getorderly.io"
                className="text-primary hover:underline"
              >
                hello@getorderly.io
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
