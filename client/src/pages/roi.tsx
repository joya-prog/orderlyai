import { useLocation } from "wouter";
import { ROICalculator } from "@/components/roi-calculator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";

export default function ROIPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="roi-back-button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="w-px h-4 bg-border" />
            <a href="https://getorderly.io/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <img src={orderlyLogo} alt="Orderly AI" className="h-7 w-7 rounded-md object-cover" />
              <span className="font-semibold text-sm">Orderly AI</span>
            </a>
          </div>
          <Button size="sm" onClick={() => navigate("/")} data-testid="roi-header-cta">
            Get Started Free
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            ROI Calculator
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            How much is your phone line losing you?
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Restaurants lose an average of <strong>$100k+ per year per location</strong> to missed calls, hold abandonment, and manual order-taking errors. 
            See your personalized ROI with Orderly AI below.
          </p>
        </div>

        {/* Calculator */}
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <ROICalculator variant="default" onSignupClick={() => navigate("/")} />
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          ROI estimates are based on your inputs and industry averages. Actual results may vary by restaurant type, volume, and operations.
          Orderly AI pricing uses pay-per-use billing — no monthly subscription required.
        </p>
      </div>
    </div>
  );
}
