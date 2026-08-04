import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bot,
  Phone,
  BookOpen,
  Plug,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

/**
 * Replaces the 17-step modal tour.
 *
 * The tour dimmed the app and narrated the nav items the user could already
 * see, then vanished — leaving a new account with nothing set up and no record
 * of what was left to do. This tracks the real state of the account instead:
 * each item reflects actual data, says why it matters, and links straight to
 * the place it gets done. It disappears on its own once setup is complete.
 */

const DISMISS_KEY = "setupChecklistDismissed";

const CALENDLY_URL = "https://calendly.com/hello-getorderly/30min";

interface ChecklistItem {
  id: string;
  title: string;
  why: string;
  href: string;
  cta: string;
  icon: typeof Bot;
  done: boolean;
  /** Opens in a new tab and never blocks completion. */
  optional?: boolean;
  external?: boolean;
}

export function SetupChecklist() {
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "true",
  );

  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });
  const { data: phoneNumbers = [] } = useQuery<any[]>({ queryKey: ["/api/phone-numbers"] });
  const { data: collections = [] } = useQuery<any[]>({ queryKey: ["/api/kb"] });
  const { data: integrations = [] } = useQuery<any[]>({ queryKey: ["/api/integrations"] });

  const hasAgent = agents.length > 0;
  // A number only takes calls once it is assigned to an agent, so an
  // unassigned number is not a completed step.
  const hasRoutedNumber = phoneNumbers.some((n) => n?.agentId);
  const hasKnowledge = collections.length > 0;
  const hasIntegration = integrations.some((i) => i?.status === "active");

  const items: ChecklistItem[] = [
    {
      id: "agent",
      title: "Create your first voice agent",
      why: "This is what answers the phone — its voice, personality, and conversation flow.",
      href: "/agents",
      cta: "Create agent",
      icon: Bot,
      done: hasAgent,
    },
    {
      id: "phone",
      title: "Connect a phone number",
      why: "Buy a number or bring your own, then assign it to an agent so real calls reach it.",
      href: "/phone-numbers",
      cta: "Add number",
      icon: Phone,
      done: hasRoutedNumber,
    },
    {
      id: "knowledge",
      title: "Add your menu and FAQs",
      why: "What your agent can actually answer — hours, specials, dietary questions, directions.",
      href: "/knowledge-base",
      cta: "Add knowledge",
      icon: BookOpen,
      done: hasKnowledge,
    },
    {
      id: "pos",
      title: "Connect your POS",
      why: "Pulls your live menu and prices from Square so answers stay current on their own.",
      href: "/integrations",
      cta: "Connect",
      icon: Plug,
      done: hasIntegration,
    },
    {
      id: "call",
      title: "Book a setup call",
      why: "Optional — 30 minutes with our team to configure your agent together.",
      href: CALENDLY_URL,
      cta: "Book a call",
      icon: CalendarDays,
      done: false,
      optional: true,
      external: true,
    },
  ];

  // Optional items are offered, never required — they must not hold the
  // checklist open or count against progress.
  const required = items.filter((i) => !i.optional);
  const completed = required.filter((i) => i.done).length;
  const allDone = completed === required.length;

  // Nothing left to nag about, or explicitly dismissed.
  if (dismissed || allDone) return null;

  const next = required.find((i) => !i.done);

  return (
    <Card className="mb-6 overflow-hidden border-primary/20">
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-3 text-left"
          data-testid="button-toggle-checklist"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Finish setting up</p>
            <p className="truncate text-xs text-muted-foreground">
              {completed} of {required.length} done
              {next ? ` · next: ${next.title.toLowerCase()}` : ""}
            </p>
          </div>
        </button>

        <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
          {required.map((i) => (
            <span
              key={i.id}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i.done ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss setup checklist"
          data-testid="button-dismiss-checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="border-t">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-start gap-4 border-b px-5 py-4 last:border-b-0"
                data-testid={`checklist-item-${item.id}`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      item.done ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {item.title}
                    {item.optional && (
                      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        optional
                      </span>
                    )}
                  </p>
                  {!item.done && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.why}
                    </p>
                  )}
                </div>

                {!item.done && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() =>
                      item.external
                        ? window.open(item.href, "_blank", "noopener,noreferrer")
                        : setLocation(item.href)
                    }
                    data-testid={`button-checklist-${item.id}`}
                  >
                    {item.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
