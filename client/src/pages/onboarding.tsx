import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRight, ArrowLeft, Building2, Phone, Globe, Utensils, Coffee, Wine, ChefHat, Hotel, Check } from "lucide-react";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";
import { onboardingSchema, type OnboardingData } from "@shared/schema";

const restaurantTypes = [
  { value: "fine_dining", label: "Fine Dining", icon: Wine },
  { value: "casual_dining", label: "Casual Dining", icon: Utensils },
  { value: "fast_casual", label: "Fast Casual", icon: Coffee },
  { value: "cafe", label: "Cafe / Coffee Shop", icon: Coffee },
  { value: "bar", label: "Bar / Pub", icon: Wine },
  { value: "catering", label: "Catering", icon: ChefHat },
  { value: "hotel", label: "Hotel / Resort", icon: Hotel },
  { value: "other", label: "Other", icon: Building2 },
];

const STEPS = ["Your restaurant", "How to reach you"] as const;

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    mode: "onChange",
    defaultValues: {
      restaurantName: "",
      restaurantType: undefined,
      restaurantPhone: "",
      restaurantWebsite: "",
    },
  });

  const name = form.watch("restaurantName");
  const type = form.watch("restaurantType");
  // Step one is the only one with required fields, so the rest is skippable.
  const canAdvance = Boolean(name?.trim() && type);

  const onboardingMutation = useMutation({
    mutationFn: async (data: OnboardingData) => apiRequest("POST", "/api/onboarding/complete", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "You're set up",
        description: "Next: create the agent that answers your phone.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Setup failed",
        description: error.message?.includes("Validation failed")
          ? "Please check the highlighted fields and try again."
          : error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OnboardingData) => onboardingMutation.mutate(data);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
        <div className="mb-10 flex items-center gap-2.5">
          <img src={orderlyLogo} alt="" className="h-7 w-7 rounded-md object-cover" />
          <span className="font-serif text-base font-semibold">Orderly AI</span>
        </div>

        {/* Progress. Two steps, so a labelled bar beats a modal counter. */}
        <div className="mb-8 flex items-center gap-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col">
            {step === 0 && (
              <div className="flex-1">
                <h1 className="font-serif text-3xl font-bold tracking-tight">
                  What's your restaurant called?
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your agent introduces itself with this name when it answers, so use what
                  guests would recognise on the phone.
                </p>

                <div className="mt-8 space-y-8">
                  <FormField
                    control={form.control}
                    name="restaurantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Restaurant name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Bella Italia"
                            className="h-12 text-base"
                            autoFocus
                            data-testid="input-restaurant-name"
                            {...field}
                          />
                        </FormControl>
                        {name?.trim() ? (
                          <p className="pt-1 text-xs text-muted-foreground">
                            Callers will hear:{" "}
                            <span className="text-foreground">
                              "Thanks for calling {name.trim()} — how can I help?"
                            </span>
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="restaurantType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">What kind of place is it?</FormLabel>
                        <p className="pb-3 text-xs text-muted-foreground">
                          Sets the starting tone and which templates we suggest. Changeable later.
                        </p>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          {restaurantTypes.map((t) => {
                            const Icon = t.icon;
                            const selected = field.value === t.value;
                            return (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => field.onChange(t.value)}
                                className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                                  selected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                                }`}
                                data-testid={`button-type-${t.value}`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`}
                                />
                                <span className="text-xs font-medium leading-tight">{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex-1">
                <h1 className="font-serif text-3xl font-bold tracking-tight">
                  How can guests reach you?
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Both optional — your agent uses them to answer "what's your number?" and to
                  point callers at your site. You can add them later in Settings.
                </p>

                <div className="mt-8 space-y-6">
                  <FormField
                    control={form.control}
                    name="restaurantPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5" />
                          Business phone
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(555) 123-4567"
                            className="h-12 text-base"
                            data-testid="input-restaurant-phone"
                            {...field}
                          />
                        </FormControl>
                        <p className="pt-1 text-xs text-muted-foreground">
                          Your existing line — not the number your AI agent will answer. You'll
                          set that up next.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="restaurantWebsite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm">
                          <Globe className="h-3.5 w-3.5" />
                          Website
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="bellaitalia.com"
                            className="h-12 text-base"
                            data-testid="input-restaurant-website"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-8 rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs font-medium">Once you're in</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    We'll walk you through creating your agent, connecting a phone number, and
                    adding your menu — a short checklist on your dashboard, at your own pace.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-10 flex items-center gap-3">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  data-testid="button-back"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}

              <div className="flex-1" />

              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  size="lg"
                  disabled={!canAdvance}
                  onClick={() => setStep((s) => s + 1)}
                  data-testid="button-next"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={onboardingMutation.isPending}
                  data-testid="button-complete-setup"
                >
                  {onboardingMutation.isPending ? "Setting up…" : "Finish setup"}
                  {!onboardingMutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
