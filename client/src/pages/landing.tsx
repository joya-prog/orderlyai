import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Phone, Zap, Users, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold font-serif">Orderly AI</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main>
        <section className="container px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-bold tracking-tight font-serif mb-6">
              Voice AI Agents for Restaurants & Hospitality
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Build, customize, and deploy intelligent phone agents that handle reservations, orders, and customer inquiries 24/7.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login">Get Started</a>
              </Button>
            </div>
          </div>
        </section>

        <section className="container px-6 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 mb-4">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Reservation Management</CardTitle>
                <CardDescription>
                  Handle table bookings, party sizes, and special requests with natural conversation
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Visual Flow Builder</CardTitle>
                <CardDescription>
                  Drag-and-drop interface to design conversation flows without coding
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Industry Templates</CardTitle>
                <CardDescription>
                  Pre-built agents for fine dining, casual dining, catering, and hotels
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="container px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-12 font-serif">
              Everything You Need
            </h2>
            <div className="grid gap-6">
              {[
                "Customizable greeting messages and personality",
                "Knowledge base for menus, hours, and policies",
                "Real-time conversation testing",
                "Restaurant-specific workflows (dietary restrictions, table availability)",
                "Multi-location support for chains",
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-lg">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t mt-24">
        <div className="container px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Orderly AI. Voice AI platform for restaurants and hospitality.
          </p>
        </div>
      </footer>
    </div>
  );
}
