import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CreditCard,
  Loader2,
  FileText,
  Download,
  ArrowLeft,
  Plus,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { SiStripe } from "react-icons/si";
import type { Subscription, Invoice } from "@shared/schema";

const BASE_MONTHLY_FEE = 149;
const USAGE_RATE_PER_MINUTE = 0.29;

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: string | number | null): string {
  if (amount === null || amount === undefined) return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num / 100);
}

export default function BillingPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: subscription, isLoading: loadingSubscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  const createPortalSession = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/create-portal-session');
      return res;
    },
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to access billing portal",
        variant: "destructive",
      });
    },
  });

  const createCheckoutSession = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/create-checkout-session', { planType: 'starter' });
      return res;
    },
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const hasPaymentMethod = !!subscription?.stripeCustomerId;
  const isTrialOrFree = !subscription?.stripeSubscriptionId || subscription?.planType === 'trial';

  const nextBillingDate = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : null;

  return (
    <div className="flex min-h-screen" data-testid="billing-page">
      <div className="w-80 border-r bg-muted/30 p-8 hidden lg:flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Orderly AI</span>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Orderly AI partners with Stripe for simplified billing.
          </p>

          <Link href="/agents">
            <Button variant="ghost" className="gap-2 px-0" data-testid="link-return-to-app">
              <ArrowLeft className="h-4 w-4" />
              Return to Orderly AI
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Powered by</span>
          <SiStripe className="h-8 w-auto" />
        </div>
      </div>

      <div className="flex-1 p-6 md:p-10 max-w-3xl">
        <div className="lg:hidden mb-6">
          <Link href="/agents">
            <Button variant="ghost" className="gap-2 px-0" data-testid="link-return-to-app-mobile">
              <ArrowLeft className="h-4 w-4" />
              Return to Orderly AI
            </Button>
          </Link>
        </div>

        {loadingSubscription ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4" data-testid="text-subscription-heading">
                Current Subscription
              </h3>

              <div className="space-y-1">
                <p className="text-lg font-medium" data-testid="text-plan-name">
                  {subscription?.planType === 'trial' ? 'Free Trial' : 'Orderly Platform'}
                </p>
                {isTrialOrFree ? (
                  <div className="space-y-3">
                    <p className="text-2xl font-bold" data-testid="text-plan-price">Free</p>
                    <p className="text-sm text-muted-foreground">
                      Add a payment method to unlock full agent capabilities and go live.
                    </p>
                    <Button
                      onClick={() => createCheckoutSession.mutate()}
                      disabled={createCheckoutSession.isPending}
                      data-testid="button-add-payment-billing"
                    >
                      {createCheckoutSession.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Payment Method
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold" data-testid="text-plan-price">
                      Price varies with usage
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${BASE_MONTHLY_FEE}/mo base + ${USAGE_RATE_PER_MINUTE}/min usage
                    </p>
                    {nextBillingDate && (
                      <p className="text-sm text-muted-foreground" data-testid="text-next-billing">
                        Your next billing date is {nextBillingDate}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4" data-testid="text-payment-heading">
                Payment Method
              </h3>

              {hasPaymentMethod && !isTrialOrFree ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-payment-status">Payment method on file</span>
                  </div>
                  <Button
                    variant="ghost"
                    className="gap-2 px-0 text-sm"
                    onClick={() => createPortalSession.mutate()}
                    disabled={createPortalSession.isPending}
                    data-testid="button-update-payment"
                  >
                    {createPortalSession.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Update payment method
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground" data-testid="text-no-payment">No payment method.</p>
                  <Button
                    variant="ghost"
                    className="gap-2 px-0 text-sm"
                    onClick={() => createCheckoutSession.mutate()}
                    disabled={createCheckoutSession.isPending}
                    data-testid="button-add-payment-method"
                  >
                    {createCheckoutSession.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add payment method
                  </Button>
                </div>
              )}
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4" data-testid="text-billing-info-heading">
                Billing Information
              </h3>

              <div className="space-y-3">
                <div className="flex gap-16">
                  <span className="text-sm text-muted-foreground w-16">Name</span>
                  <span className="text-sm font-medium" data-testid="text-billing-name">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email?.split('@')[0] || 'Not set'}
                  </span>
                </div>
                <div className="flex gap-16">
                  <span className="text-sm text-muted-foreground w-16">Email</span>
                  <span className="text-sm font-medium" data-testid="text-billing-email">
                    {user?.email || 'Not set'}
                  </span>
                </div>

                {hasPaymentMethod && (
                  <Button
                    variant="ghost"
                    className="gap-2 px-0 text-sm"
                    onClick={() => createPortalSession.mutate()}
                    disabled={createPortalSession.isPending}
                    data-testid="button-update-billing-info"
                  >
                    {createPortalSession.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-3 w-3" />
                    )}
                    Update information
                  </Button>
                )}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4" data-testid="text-invoice-heading">
                Invoice History
              </h3>

              {loadingInvoices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">
                            {formatDate(invoice.createdAt)}
                          </span>
                          <Badge
                            variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                            className="ml-2 text-xs"
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" data-testid={`text-invoice-amount-${invoice.id}`}>
                          {formatCurrency(invoice.amountDue)}
                        </span>
                        {invoice.hostedInvoiceUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                            data-testid={`button-download-invoice-${invoice.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-invoices">No invoice history.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
