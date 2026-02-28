import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRight, Building2, Phone, Globe, Utensils, Coffee, Wine, ChefHat, Hotel, Sparkles } from "lucide-react";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";
import { onboardingSchema, type OnboardingData } from "@shared/schema";

const restaurantTypes = [
  { value: "fine_dining", label: "Fine Dining", icon: Wine },
  { value: "casual_dining", label: "Casual Dining", icon: Utensils },
  { value: "fast_casual", label: "Fast Casual", icon: Coffee },
  { value: "cafe", label: "Cafe / Coffee Shop", icon: Coffee },
  { value: "bar", label: "Bar / Pub", icon: Wine },
  { value: "catering", label: "Catering Service", icon: ChefHat },
  { value: "hotel", label: "Hotel / Resort", icon: Hotel },
  { value: "other", label: "Other", icon: Building2 },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("");

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      restaurantName: "",
      restaurantType: undefined,
      restaurantPhone: "",
      restaurantWebsite: "",
    },
  });

  const onboardingMutation = useMutation({
    mutationFn: async (data: OnboardingData) => {
      return apiRequest("POST", "/api/onboarding/complete", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Welcome to Orderly AI!",
        description: "Your restaurant is all set up. Let's create your first AI agent.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      let description = "Something went wrong. Please try again.";
      if (error.message.includes("Validation failed")) {
        description = "Please fill in all required fields correctly.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: "Setup failed",
        description,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OnboardingData) => {
    onboardingMutation.mutate(data);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center px-6 py-4 sm:px-12 lg:px-24">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img
              src={orderlyLogo}
              alt="Orderly AI"
              className="h-8 w-8 rounded-lg object-cover"
              data-testid="img-logo-onboarding"
            />
            <span className="text-xl font-semibold font-serif">Orderly AI</span>
          </div>
          <h1 className="text-2xl font-bold font-serif mb-1" data-testid="text-onboarding-title">
            Welcome! Let's set up your restaurant
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us a bit about your business so we can customize your AI agent
          </p>
        </div>

        <Card className="shadow-lg border-2">
          <CardHeader className="pb-2 pt-4 px-6">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-medium">Quick Setup</span>
            </div>
            <CardTitle className="text-lg">Restaurant Information</CardTitle>
            <CardDescription className="text-xs">
              This helps us create the perfect AI voice agent for your business
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="restaurantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3.5 w-3.5" />
                        Restaurant Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Bella Italia, The Golden Fork"
                          data-testid="input-restaurant-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="restaurantType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">What type of establishment are you?</FormLabel>
                      <div className="grid gap-2 grid-cols-4 mt-1">
                        {restaurantTypes.map((type) => {
                          const Icon = type.icon;
                          const isSelected = field.value === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => {
                                field.onChange(type.value);
                                setSelectedType(type.value);
                              }}
                              className={`p-2 rounded-lg border-2 text-left transition-all hover-elevate ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-muted hover:border-primary/50"
                              }`}
                              data-testid={`button-type-${type.value}`}
                            >
                              <Icon className={`h-4 w-4 mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <p className="font-medium text-xs leading-tight">{type.label}</p>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="restaurantPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5" />
                          Business Phone
                          <span className="text-muted-foreground text-xs">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(555) 123-4567"
                            data-testid="input-restaurant-phone"
                            {...field}
                          />
                        </FormControl>
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
                          <span className="text-muted-foreground text-xs">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="www.myrestaurant.com"
                            data-testid="input-restaurant-website"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={onboardingMutation.isPending}
                    data-testid="button-complete-setup"
                  >
                    {onboardingMutation.isPending ? (
                      "Setting up your account..."
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-2">
          You can update this information anytime in your settings
        </p>
      </div>
    </div>
  );
}
