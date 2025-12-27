import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Zap, Users, CheckCircle, Clock, Star, ArrowRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img 
              src={orderlyLogo} 
              alt="Orderly AI" 
              className="h-10 w-10 rounded-lg object-cover"
              data-testid="img-logo-landing"
            />
            <span className="text-xl font-semibold font-serif">Orderly AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild data-testid="button-login-header">
              <a href="/auth">Sign In</a>
            </Button>
            <Button asChild data-testid="button-get-started-header">
              <a href="/auth">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="container px-6 py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
                <Star className="h-4 w-4" />
                Trusted by 500+ restaurants
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight font-serif mb-6">
                Never Miss a Call Again
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
                AI voice agents that handle reservations, orders, and customer inquiries 24/7. 
                Let your staff focus on what matters while we answer every call.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="h-12 px-6 text-base" asChild data-testid="button-get-started-hero">
                  <a href="/api/auth/google" className="flex items-center gap-2">
                    <SiGoogle className="h-5 w-5" />
                    Continue with Google
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild data-testid="button-login-email">
                  <a href="/auth" className="flex items-center gap-2">
                    Sign in with Email
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Free 14-day trial. No credit card required.
              </p>
            </div>
            
            <div className="relative">
              <Card className="border-2 shadow-xl">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Incoming Call</p>
                      <p className="text-sm text-muted-foreground">From: (555) 123-4567</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">AI Agent</p>
                      <p className="text-sm text-muted-foreground">
                        "Thank you for calling Bella Italia! I'd be happy to help you with a reservation. How many guests will be dining with us tonight?"
                      </p>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">Caller</p>
                      <p className="text-sm text-muted-foreground">
                        "Hi, I'd like a table for 4 at 7pm on Saturday."
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">AI Agent</p>
                      <p className="text-sm text-muted-foreground">
                        "Perfect! I have a lovely table available for 4 guests this Saturday at 7pm. May I have a name for the reservation?"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-lg bg-primary/10" />
            </div>
          </div>
        </section>

        <section className="bg-muted/30 py-16 md:py-20">
          <div className="container px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">
                Built for Restaurants
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to provide exceptional phone service without the overhead
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Reservation Management</h3>
                  <p className="text-muted-foreground">
                    Handle table bookings, party sizes, and special requests with natural conversation
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">24/7 Availability</h3>
                  <p className="text-muted-foreground">
                    Never miss a call, even during busy hours or after closing time
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Quick Setup</h3>
                  <p className="text-muted-foreground">
                    Get your AI agent running in minutes with pre-built restaurant templates
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="container px-6 py-16 md:py-20">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold font-serif mb-6">
                Everything Your Restaurant Needs
              </h2>
              <div className="space-y-4">
                {[
                  "Customizable greeting messages and personality",
                  "Knowledge base for menus, hours, and policies",
                  "Real-time conversation testing before going live",
                  "Restaurant-specific workflows (dietary restrictions, table availability)",
                  "Multi-location support for chains and franchises",
                  "Seamless handoff to human staff when needed",
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary mb-2">98%</p>
                  <p className="text-sm text-muted-foreground">Call Answer Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary mb-2">30s</p>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary mb-2">500+</p>
                  <p className="text-sm text-muted-foreground">Restaurants Trust Us</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary mb-2">24/7</p>
                  <p className="text-sm text-muted-foreground">Always Available</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-primary text-primary-foreground py-16 md:py-20">
          <div className="container px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">
              Ready to Transform Your Phone Service?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Join hundreds of restaurants already using Orderly AI to handle their calls. 
              Get started in minutes with our free trial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild data-testid="button-get-started-cta">
                <a href="/api/auth/google" className="flex items-center gap-2">
                  <SiGoogle className="h-5 w-5" />
                  Continue with Google
                </a>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base border-primary-foreground/20 hover:bg-primary-foreground/10" asChild data-testid="button-login-email-cta">
                <a href="/auth">
                  Sign in with Email
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src={orderlyLogo} 
                alt="Orderly AI" 
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="font-semibold font-serif">Orderly AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Orderly AI. Voice AI platform for restaurants and hospitality.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
