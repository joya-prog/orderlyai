import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { queryClient } from "@/lib/queryClient";
import { PricingCalculator } from "@/components/pricing-calculator";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      toast({
        title: "Account created!",
        description: "Welcome to Orderly AI. Let's set up your restaurant.",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-white dark:bg-gray-950 p-6 lg:p-10 overflow-hidden">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img 
              src={orderlyLogo} 
              alt="Orderly AI" 
              className="h-10 w-10 rounded-lg object-cover"
              data-testid="img-logo-auth"
            />
            <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              Orderly AI
            </span>
          </div>
          <div className="mb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
              {isLoginMode ? "Welcome Back" : "Get Started"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {isLoginMode 
                ? "Enter your email and password to access your account." 
                : "Create your account to start using AI voice agents."}
            </p>
          </div>

          <form onSubmit={isLoginMode ? handleLogin : handleSignup} className="space-y-5">
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="input-name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@restaurant.com"
                className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={isLoginMode ? "Enter your password" : "Create a password (min 8 characters)"}
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                />
              </div>
            )}

            {isLoginMode && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    data-testid="checkbox-remember"
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    Remember Me
                  </Label>
                </div>
                <button 
                  type="button" 
                  className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                  data-testid="link-forgot-password"
                >
                  Forgot Your Password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isLoginMode ? "Log In" : "Create Account"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-950 px-4 text-gray-500">Or Login With</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              variant="outline"
              className="h-12 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              data-testid="button-google-auth"
            >
              <SiGoogle className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            {isLoginMode ? "Don't Have An Account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-indigo-600 hover:text-indigo-500 font-medium"
              data-testid="button-toggle-mode"
            >
              {isLoginMode ? "Register Now." : "Sign In."}
            </button>
          </p>
        </div>
      </div>

      {/* Right Side - Pricing Calculator */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-6 flex-col items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              Estimate your Cost
            </h2>
            <p className="text-white/70 text-xs">
              Adjust your usage, LLM, engine, to see real time pricing for our AI voice agent solution.
            </p>
          </div>

          <PricingCalculator variant="compact" />

          <p className="text-white/50 text-[10px] mt-3 text-center">
            Pricing is estimated. Actual costs may vary.
          </p>
        </div>
      </div>
    </div>
  );
}
