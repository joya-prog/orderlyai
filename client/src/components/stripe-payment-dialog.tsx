import { useState, useEffect, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";

interface StripePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const setupIntentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/billing/create-setup-intent");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/billing/confirm-payment-method");
    },
  });

  useEffect(() => {
    setupIntentMutation.mutate();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !setupIntentMutation.data?.clientSecret) return;

    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(
        setupIntentMutation.data.clientSecret,
        {
          payment_method: { card: cardElement },
        }
      );

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message || "Please check your card details and try again.",
          variant: "destructive",
        });
      } else if (setupIntent.status === "succeeded") {
        await confirmMutation.mutateAsync();
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        toast({
          title: "Payment method added",
          description: "Your card has been saved successfully.",
        });
        onSuccess();
      }
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (setupIntentMutation.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (setupIntentMutation.isError) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-4">Failed to initialize payment form.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setupIntentMutation.mutate()}
          data-testid="button-retry-payment"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="card-element">
          Card details
        </label>
        <div className="rounded-md border p-4 bg-background">
          <CardElement
            id="card-element"
            onChange={(e) => setCardComplete(e.complete)}
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "hsl(var(--foreground))",
                  "::placeholder": {
                    color: "hsl(var(--muted-foreground))",
                  },
                },
                invalid: {
                  color: "hsl(var(--destructive))",
                },
              },
            }}
          />
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p data-testid="text-pricing-note">Price varies with usage</p>
        <p data-testid="text-next-billing-date">
          Your next billing date is the first of the month:{" "}
          {(() => {
            const now = new Date();
            const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return `${String(next.getMonth() + 1).padStart(2, "0")}/${String(next.getDate()).padStart(2, "0")}/${next.getFullYear()}`;
          })()}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Your payment info is encrypted and secure</span>
      </div>

      <Button
        type="submit"
        className="w-full gap-2"
        disabled={!stripe || !cardComplete || isProcessing}
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {isProcessing ? "Saving..." : "Save Payment Method"}
      </Button>
    </form>
  );
}

export function StripePaymentDialog({ open, onOpenChange }: StripePaymentDialogProps) {
  const { data: stripeConfig } = useQuery<{ publishableKey: string; hasStripeConnection: boolean }>({
    queryKey: ["/api/billing/stripe-config"],
    enabled: open,
  });

  const stripePromise = useMemo(() => {
    const key = stripeConfig?.publishableKey;
    if (key && typeof key === "string" && key.startsWith("pk_")) {
      return loadStripe(key);
    }
    return null;
  }, [stripeConfig?.publishableKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-stripe-payment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Add Payment Method
          </DialogTitle>
          <DialogDescription>
            Add a card to unlock full agent capabilities and go live.
          </DialogDescription>
        </DialogHeader>

        {stripeConfig && !stripeConfig.hasStripeConnection ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Payment processing is not configured yet. Please contact support.
            </p>
          </div>
        ) : stripePromise ? (
          <Elements stripe={stripePromise}>
            <PaymentForm onSuccess={() => onOpenChange(false)} />
          </Elements>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
