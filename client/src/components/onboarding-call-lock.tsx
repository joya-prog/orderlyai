import { CalendarDays } from "lucide-react";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";
import type { User } from "@shared/schema";

const CALENDLY_URL = "https://calendly.com/hello-getorderly/30min";

interface OnboardingCallLockProps {
  user: User;
}

export function OnboardingCallLock({ user }: OnboardingCallLockProps) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30"
      data-testid="onboarding-call-lock"
    >
      <div className="relative w-full max-w-2xl mx-4">
        {/* Card */}
        <div className="rounded-2xl bg-background border border-border/40 shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <img
                src={orderlyLogo}
                alt="Orderly AI"
                className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
                data-testid="img-lock-logo"
              />
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h1 className="text-base font-semibold text-foreground" data-testid="heading-lock">
                    Book your setup call to get started
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every new account is onboarded 1:1 to ensure your AI agent works perfectly from day one.
                </p>
              </div>
            </div>
            {user.restaurantName && (
              <span
                className="text-xs text-muted-foreground font-medium flex-shrink-0"
                data-testid="text-lock-restaurant-name"
              >
                {user.restaurantName}
              </span>
            )}
          </div>

          {/* Calendly embed */}
          <iframe
            src={CALENDLY_URL}
            width="100%"
            height="650"
            frameBorder="0"
            title="Book your Orderly AI setup call"
            data-testid="iframe-calendly"
            className="block"
          />

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border/50 bg-muted/30">
            <p
              className="text-xs text-muted-foreground text-center"
              data-testid="text-lock-footer"
            >
              After your call, your account manager will unlock your dashboard. Questions?{" "}
              <a href="mailto:hello@getorderly.io" className="text-primary hover:underline">
                hello@getorderly.io
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
