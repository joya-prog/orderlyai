import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays, Clock, UtensilsCrossed, HelpCircle,
  CheckCircle2, Plus, X, ChevronRight, ChevronLeft,
} from "lucide-react";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import type { PreCallIntake } from "@shared/schema";

const CALENDLY_URL = "https://calendly.com/hello-getorderly/30min";
const CALENDLY_ORIGIN = "https://calendly.com";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (AST)" },
  { value: "other", label: "Other / Not listed…" },
];

const PRICE_RANGES = [
  { value: "under_15", label: "Under $15 per person" },
  { value: "15_30", label: "$15 – $30 per person" },
  { value: "30_50", label: "$30 – $50 per person" },
  { value: "50_plus", label: "$50+ per person" },
];

type Step = "calendly" | "hours" | "menu" | "faqs" | "done";

interface OnboardingCallLockProps {
  user: User;
}

function TagInput({
  value,
  onChange,
  placeholder,
  max,
  testId,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  testId?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (max && value.length >= max) return;
    if (value.includes(tag)) { setInput(""); return; }
    onChange([...value, tag]);
    setInput("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
    else if (e.key === "Backspace" && !input && value.length > 0) onChange(value.slice(0, -1));
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 border border-input rounded-md px-3 py-2 min-h-[40px] cursor-text bg-background"
      onClick={() => inputRef.current?.focus()}
      data-testid={testId}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs py-0.5">
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((t) => t !== tag)); }}
            className="ml-0.5 hover:text-destructive"
            data-testid={`remove-tag-${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {(!max || value.length < max) && (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => addTag(input)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder:text-muted-foreground"
          data-testid={testId ? `${testId}-input` : undefined}
        />
      )}
    </div>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const steps: { key: Step; label: string; Icon: typeof Clock }[] = [
    { key: "hours", label: "Hours", Icon: Clock },
    { key: "menu", label: "Menu", Icon: UtensilsCrossed },
    { key: "faqs", label: "Questions", Icon: HelpCircle },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="border-b border-border/50 bg-muted/20">
      <div className="px-6 pt-2.5 pb-0 text-xs text-muted-foreground font-medium" data-testid="text-step-progress">
        Step {activeIdx + 1} of {steps.length} — {steps[activeIdx]?.label}
      </div>
      <div className="flex items-center px-6 py-3">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        const { Icon } = s;
        return (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                done ? "bg-primary text-primary-foreground"
                  : active ? "bg-primary/10 border-2 border-primary text-primary"
                  : "bg-muted border border-border text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function StepHours({
  data,
  onChange,
  onNext,
}: {
  data: PreCallIntake;
  onChange: (patch: Partial<PreCallIntake>) => void;
  onNext: () => void;
}) {
  // If data.timezone is a value not in the predefined list, it's a custom zone from a previous
  // "Other" selection. Restore it so the user can see and edit it when navigating back.
  const isPredefined = TIMEZONES.some((tz) => tz.value === data.timezone);
  const selectValue = isPredefined ? data.timezone : "other";
  const [customTimezone, setCustomTimezone] = useState(
    !isPredefined && data.timezone !== "other" ? data.timezone : "",
  );
  const showCustomInput = selectValue === "other";
  const canContinue = data.businessHours.trim().length > 0
    && (showCustomInput ? customTimezone.trim().length > 0 : data.timezone.length > 0);

  function handleSelectChange(v: string) {
    if (v !== "other") {
      onChange({ timezone: v });
    } else {
      onChange({ timezone: "other" });
    }
  }

  function handleContinue() {
    if (showCustomInput && customTimezone.trim()) {
      onChange({ timezone: customTimezone.trim() });
    }
    onNext();
  }

  return (
    <div className="px-6 py-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground" data-testid="heading-step-hours">
          When are you open?
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your AI agent will use these hours to know when to take orders and reservations.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Business hours</label>
          <Textarea
            data-testid="input-business-hours"
            placeholder="e.g. Mon–Fri 11am–10pm, Sat–Sun 10am–11pm, Closed Tuesdays"
            value={data.businessHours}
            onChange={(e) => onChange({ businessHours: e.target.value })}
            className="resize-none text-sm"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Timezone</label>
          <Select
            value={selectValue}
            onValueChange={handleSelectChange}
          >
            <SelectTrigger data-testid="select-timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showCustomInput && (
            <Input
              data-testid="input-custom-timezone"
              placeholder="e.g. Europe/London, Asia/Tokyo, Australia/Sydney"
              value={customTimezone}
              onChange={(e) => setCustomTimezone(e.target.value)}
              className="text-sm mt-1.5"
            />
          )}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={handleContinue} disabled={!canContinue} data-testid="button-hours-continue">
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StepMenu({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: PreCallIntake;
  onChange: (patch: Partial<PreCallIntake>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canContinue = data.cuisineDescription.trim().length > 0;

  return (
    <div className="px-6 py-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground" data-testid="heading-step-menu">
          Tell us about your menu
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          This helps us configure your AI to accurately describe your food and handle ordering questions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Describe your food in one sentence</label>
          <Input
            data-testid="input-cuisine-description"
            placeholder="e.g. Upscale American burgers and craft cocktails"
            value={data.cuisineDescription}
            onChange={(e) => onChange({ cuisineDescription: e.target.value })}
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Menu categories
            <span className="text-muted-foreground font-normal ml-1">(Enter or comma to add, max 8)</span>
          </label>
          <TagInput
            value={data.menuCategories}
            onChange={(v) => onChange({ menuCategories: v })}
            placeholder="e.g. Starters, Mains, Drinks…"
            max={8}
            testId="input-menu-categories"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Most popular items
            <span className="text-muted-foreground font-normal ml-1">(max 10)</span>
          </label>
          <TagInput
            value={data.popularItems}
            onChange={(v) => onChange({ popularItems: v })}
            placeholder="e.g. Classic Smash Burger, Truffle Fries…"
            max={10}
            testId="input-popular-items"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Price range</label>
          <Select value={data.priceRange} onValueChange={(v) => onChange({ priceRange: v })}>
            <SelectTrigger data-testid="select-price-range">
              <SelectValue placeholder="Select price range" />
            </SelectTrigger>
            <SelectContent>
              {PRICE_RANGES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-menu-back"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <Button onClick={onNext} disabled={!canContinue} data-testid="button-menu-continue">
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StepFaqs({
  data,
  onChange,
  onSubmit,
  onBack,
  isPending,
}: {
  data: PreCallIntake;
  onChange: (patch: Partial<PreCallIntake>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  function updateFaq(idx: number, field: keyof PreCallIntake["faqs"][number], value: string) {
    const updated = data.faqs.map((faq, i) => i === idx ? { ...faq, [field]: value } : faq);
    onChange({ faqs: updated });
  }

  function addFaq() {
    if (data.faqs.length >= 5) return;
    onChange({ faqs: [...data.faqs, { question: "", answer: "" }] });
  }

  function removeFaq(idx: number) {
    onChange({ faqs: data.faqs.filter((_, i) => i !== idx) });
  }

  return (
    <div className="px-6 py-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground" data-testid="heading-step-faqs">
          What do customers ask you most?
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your AI will know the answers to these before your call even starts.
        </p>
      </div>

      <div className="space-y-3">
        {data.faqs.map((faq, idx) => (
          <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground flex-shrink-0">Q{idx + 1}</span>
              <Input
                data-testid={`input-faq-question-${idx}`}
                placeholder="e.g. Do you offer delivery?"
                value={faq.question}
                onChange={(e) => updateFaq(idx, "question", e.target.value)}
                className="text-sm"
              />
              {data.faqs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFaq(idx)}
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  data-testid={`button-remove-faq-${idx}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Textarea
              data-testid={`input-faq-answer-${idx}`}
              placeholder="Your answer…"
              value={faq.answer}
              onChange={(e) => updateFaq(idx, "answer", e.target.value)}
              className="resize-none text-sm"
              rows={2}
            />
          </div>
        ))}

        {data.faqs.length < 5 && (
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            data-testid="button-add-faq"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another question
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Special policies</label>
        <Textarea
          data-testid="input-policies"
          placeholder="Anything else the AI should know? e.g. We accept cash only. We have an allergy menu available on request."
          value={data.policies}
          onChange={(e) => onChange({ policies: e.target.value })}
          className="resize-none text-sm"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-faqs-back"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <Button onClick={onSubmit} disabled={isPending} data-testid="button-save-finish">
          {isPending ? "Saving…" : "Save & Finish"}
          {!isPending && <CheckCircle2 className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}

const CHECKLIST_ITEMS = [
  "Your AI phone agent's voice and personality",
  "Live call testing with your phone number",
  "Menu and ordering knowledge",
  "Hours of operation and after-hours handling",
  "POS integration (optional)",
];

function DoneScreen({ restaurantName }: { restaurantName?: string }) {
  return (
    <div className="px-6 py-8 flex flex-col items-center text-center gap-5">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground" data-testid="heading-done">
          You're all set{restaurantName ? `, ${restaurantName}` : ""}!
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Your setup call is booked and your restaurant details are saved. Your account manager will
          review your info before the call so you can hit the ground running.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-border/60 bg-muted/20 p-4 text-left">
        <p className="text-xs font-semibold text-foreground mb-2.5">What we'll build on your call:</p>
        <ul className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Check your email for the calendar invite.</p>
        <p>
          Questions?{" "}
          <a href="mailto:hello@getorderly.io" className="text-primary hover:underline">
            hello@getorderly.io
          </a>
        </p>
        <p className="font-medium text-foreground/70 mt-2">
          Your dashboard will be unlocked by your account manager after your call.
        </p>
      </div>
    </div>
  );
}

const DEFAULT_INTAKE: PreCallIntake = {
  businessHours: "",
  timezone: "America/New_York",
  cuisineDescription: "",
  menuCategories: [],
  popularItems: [],
  priceRange: "",
  faqs: [
    { question: "Do you offer delivery?", answer: "" },
    { question: "Do you take reservations?", answer: "" },
  ],
  policies: "",
};

export function OnboardingCallLock({ user }: OnboardingCallLockProps) {
  const hasIntake = !!user.preCallIntake;
  const [step, setStep] = useState<Step>(hasIntake ? "done" : "calendly");
  const [formData, setFormData] = useState<PreCallIntake>(DEFAULT_INTAKE);

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.origin !== CALENDLY_ORIGIN) return;
      if (e.data?.event === "calendly.event_scheduled") {
        setStep("hours");
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (intake: PreCallIntake) =>
      apiRequest("PATCH", "/api/user/pre-call-intake", { preCallIntake: intake }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setStep("done");
    },
  });

  function patch(p: Partial<PreCallIntake>) {
    setFormData((prev) => ({ ...prev, ...p }));
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30" data-testid="onboarding-call-lock">
      <div className="relative w-full max-w-2xl mx-4">
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
                    {step === "done"
                      ? "Setup call booked"
                      : step === "calendly"
                      ? "Book your setup call to get started"
                      : "Tell us about your restaurant"}
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step === "done"
                    ? "We'll see you on your call. Your dashboard will be unlocked after."
                    : step === "calendly"
                    ? "Every new account is onboarded 1:1 to ensure your AI agent works perfectly from day one."
                    : "This info will be ready for your account manager before your call."}
                </p>
              </div>
            </div>
            {user.restaurantName && (
              <span className="text-xs text-muted-foreground font-medium flex-shrink-0" data-testid="text-lock-restaurant-name">
                {user.restaurantName}
              </span>
            )}
          </div>

          {/* Progress indicator for intake steps */}
          {(step === "hours" || step === "menu" || step === "faqs") && (
            <ProgressBar step={step} />
          )}

          {/* Step content */}
          {step === "calendly" && (
            <>
              <iframe
                src={CALENDLY_URL}
                width="100%"
                height="650"
                frameBorder="0"
                title="Book your Orderly AI setup call"
                data-testid="iframe-calendly"
                className="block"
              />
              <div className="px-6 py-3 border-t border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground text-center" data-testid="text-lock-footer">
                  After your call, your account manager will unlock your dashboard. Questions?{" "}
                  <a href="mailto:hello@getorderly.io" className="text-primary hover:underline">
                    hello@getorderly.io
                  </a>
                </p>
              </div>
            </>
          )}

          {step === "hours" && (
            <StepHours data={formData} onChange={patch} onNext={() => setStep("menu")} />
          )}

          {step === "menu" && (
            <StepMenu data={formData} onChange={patch} onNext={() => setStep("faqs")} onBack={() => setStep("hours")} />
          )}

          {step === "faqs" && (
            <StepFaqs
              data={formData}
              onChange={patch}
              onSubmit={() => saveMutation.mutate(formData)}
              onBack={() => setStep("menu")}
              isPending={saveMutation.isPending}
            />
          )}

          {step === "done" && <DoneScreen restaurantName={user.restaurantName ?? undefined} />}
        </div>
      </div>
    </div>
  );
}
