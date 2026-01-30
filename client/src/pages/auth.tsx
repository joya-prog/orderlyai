import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { queryClient } from "@/lib/queryClient";
import { PricingCalculator } from "@/components/pricing-calculator";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";

type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'reset-success' | '2fa-verify';

export default function Auth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  
  // Separate state for reset password flow
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  // 2FA verification state
  const [pendingToken, setPendingToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'sms'>('totp');
  const [phoneLastFour, setPhoneLastFour] = useState("");
  const [resendingCode, setResendingCode] = useState(false);

  // Clear form state when switching views
  const resetFormState = () => {
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowPassword(false);
  };

  // Check for reset token or 2FA params in URL
  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get('token');
    const requires2fa = params.get('requires2fa');
    const pendingFromUrl = params.get('pendingToken');
    
    if (token) {
      setResetToken(token);
      setAuthView('reset-password');
    } else if (requires2fa === 'true') {
      // Clear URL params first
      window.history.replaceState({}, document.title, '/auth');
      
      if (pendingFromUrl) {
        // Token from email/password login (passed in response)
        setPendingToken(pendingFromUrl);
        setAuthView('2fa-verify');
      } else {
        // Token from Google OAuth (stored in session, fetch it)
        fetch('/api/auth/2fa/pending-token', { credentials: 'include' })
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('No pending session');
          })
          .then(data => {
            setPendingToken(data.pendingToken);
            setTwoFactorMethod(data.method || 'totp');
            setPhoneLastFour(data.phoneLastFour || '');
            setAuthView('2fa-verify');
            if (data.method === 'sms') {
              toast({
                title: "Verification Code Sent",
                description: `A code has been sent to your phone ending in ${data.phoneLastFour}.`,
              });
            }
          })
          .catch(() => {
            toast({
              title: "Session expired",
              description: "Please log in again.",
              variant: "destructive",
            });
            setAuthView('login');
          });
      }
    }
  }, [search, toast]);

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

      // Check if 2FA is required
      if (data.requires2FA && data.pendingToken) {
        setPendingToken(data.pendingToken);
        setTwoFactorMethod(data.method || 'totp');
        setPhoneLastFour(data.phoneLastFour || '');
        setAuthView('2fa-verify');
        toast({
          title: "Two-Factor Authentication",
          description: data.method === 'sms' 
            ? `A verification code has been sent to your phone ending in ${data.phoneLastFour}.`
            : "Please enter your verification code to continue.",
        });
        return;
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send reset email");
      }

      setForgotPasswordSent(true);
      toast({
        title: "Check your email",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      setAuthView('reset-success');
      toast({
        title: "Password reset successful",
        description: "You can now log in with your new password.",
      });
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let endpoint: string;
      let body: object;
      
      if (useBackupCode) {
        endpoint = "/api/auth/2fa/verify-backup";
        body = { pendingToken, backupCode };
      } else if (twoFactorMethod === 'sms') {
        endpoint = "/api/auth/2fa/verify-sms";
        body = { pendingToken, code: twoFactorCode };
      } else {
        endpoint = "/api/auth/2fa/verify-login";
        body = { pendingToken, code: twoFactorCode };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification failed");
      }

      // Show warning about remaining backup codes if applicable
      if (data.remainingBackupCodes !== undefined && data.remainingBackupCodes < 3) {
        toast({
          title: "Low Backup Codes",
          description: `You have ${data.remainingBackupCodes} backup codes remaining. Consider regenerating them in Settings.`,
          variant: "destructive",
        });
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isLoginMode = authView === 'login';
  const isSignupMode = authView === 'signup';

  // Render different views based on authView state
  const renderAuthContent = () => {
    // Forgot Password View
    if (authView === 'forgot-password') {
      return (
        <>
          <button
            type="button"
            onClick={() => {
              resetFormState();
              setForgotPasswordEmail("");
              setForgotPasswordSent(false);
              setAuthView('login');
            }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
            data-testid="button-back-to-login"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </button>

          <div className="mb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
              Forgot Password
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {forgotPasswordSent ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Check your email</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                If an account exists with <strong>{forgotPasswordEmail}</strong>, you'll receive a password reset link shortly.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  resetFormState();
                  setForgotPasswordSent(false);
                  setForgotPasswordEmail("");
                  setAuthView('login');
                }}
                data-testid="button-back-to-login-after-sent"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@restaurant.com"
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  data-testid="input-forgot-email"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                disabled={isLoading}
                data-testid="button-send-reset-link"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send Reset Link
              </Button>
            </form>
          )}
        </>
      );
    }

    // Reset Password View
    if (authView === 'reset-password') {
      return (
        <>
          <div className="mb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
              Set New Password
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a new password (min 8 characters)"
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500 pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  data-testid="button-toggle-new-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm New Password
              </Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="Confirm your new password"
                className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-confirm-new-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
              disabled={isLoading}
              data-testid="button-reset-password"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Reset Password
            </Button>
          </form>
        </>
      );
    }

    // 2FA Verification View
    if (authView === '2fa-verify') {
      const handleCancel2FA = async () => {
        // Cancel the pending session on the server
        try {
          await fetch('/api/auth/2fa/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingToken }),
            credentials: 'include',
          });
        } catch (e) {
          // Ignore errors, just cleaning up
        }
        resetFormState();
        setTwoFactorCode("");
        setBackupCode("");
        setUseBackupCode(false);
        setPendingToken("");
        setTwoFactorMethod('totp');
        setPhoneLastFour("");
        setIsLoading(false);
        setAuthView('login');
      };

      const handleResendSmsCode = async () => {
        if (resendingCode) return;
        setResendingCode(true);
        try {
          const response = await fetch('/api/auth/2fa/resend-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingToken }),
            credentials: 'include',
          });
          const data = await response.json();
          if (response.ok) {
            toast({
              title: "Code Sent",
              description: `A new verification code has been sent to your phone.`,
            });
          } else {
            throw new Error(data.message || 'Failed to resend code');
          }
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to resend verification code",
            variant: "destructive",
          });
        } finally {
          setResendingCode(false);
        }
      };

      const getVerificationMessage = () => {
        if (useBackupCode) {
          return "Enter one of your backup codes to continue.";
        }
        if (twoFactorMethod === 'sms') {
          return phoneLastFour 
            ? `Enter the 6-digit code sent to your phone ending in ${phoneLastFour}.`
            : "Enter the 6-digit code sent to your phone.";
        }
        return "Enter the 6-digit code from your authenticator app.";
      };

      return (
        <>
          <button
            type="button"
            onClick={handleCancel2FA}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
            data-testid="button-cancel-2fa"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel and try again
          </button>

          <div className="mb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
              Two-Factor Authentication
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {getVerificationMessage()}
            </p>
          </div>

          <form onSubmit={handle2FAVerify} className="space-y-5">
            {useBackupCode ? (
              <div className="space-y-2">
                <Label htmlFor="backup-code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Backup Code
                </Label>
                <Input
                  id="backup-code"
                  type="text"
                  placeholder="Enter your backup code"
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500 text-center font-mono text-lg tracking-wider"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  required
                  data-testid="input-backup-code"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totp-code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Verification Code
                </Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-indigo-500 focus:ring-indigo-500 text-center font-mono text-2xl tracking-[0.5em]"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  data-testid="input-totp-code"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
              disabled={isLoading || (!useBackupCode && twoFactorCode.length !== 6) || (useBackupCode && !backupCode)}
              data-testid="button-verify-2fa"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Verify
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {twoFactorMethod === 'sms' && !useBackupCode && (
              <button
                type="button"
                onClick={handleResendSmsCode}
                className="text-sm text-indigo-600 hover:text-indigo-500 font-medium disabled:opacity-50"
                disabled={resendingCode}
                data-testid="button-resend-sms"
              >
                {resendingCode ? "Sending..." : "Resend verification code"}
              </button>
            )}
            <div>
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setTwoFactorCode("");
                  setBackupCode("");
                  setIsLoading(false);
                }}
                className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                data-testid="button-toggle-backup-code"
              >
                {useBackupCode 
                  ? (twoFactorMethod === 'sms' ? "Enter SMS code instead" : "Use authenticator app instead") 
                  : "Use a backup code"}
              </button>
            </div>
          </div>
        </>
      );
    }

    // Reset Success View
    if (authView === 'reset-success') {
      return (
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Password Reset Successful</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <Button
            onClick={() => {
              resetFormState();
              setResetToken("");
              setAuthView('login');
              // Clear URL query params
              window.history.replaceState({}, document.title, '/auth');
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="button-go-to-login"
          >
            Go to Login
          </Button>
        </div>
      );
    }

    // Login/Signup View (default)
    return (
      <>
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
          {isSignupMode && (
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

          {isSignupMode && (
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
                onClick={() => {
                  resetFormState();
                  setAuthView('forgot-password');
                }}
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
            onClick={() => {
              resetFormState();
              setAuthView(isLoginMode ? 'signup' : 'login');
            }}
            className="text-indigo-600 hover:text-indigo-500 font-medium"
            data-testid="button-toggle-mode"
          >
            {isLoginMode ? "Register Now." : "Sign In."}
          </button>
        </p>
      </>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-white dark:bg-gray-950 p-6 lg:p-10 overflow-hidden">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link 
            href="/"
            className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity cursor-pointer"
            data-testid="link-logo-auth"
          >
            <img 
              src={orderlyLogo} 
              alt="Orderly AI" 
              className="h-10 w-10 rounded-lg object-cover"
              data-testid="img-logo-auth"
            />
            <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              Orderly AI
            </span>
          </Link>
          
          {renderAuthContent()}
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
              Adjust your usage, and AI model to see real time pricing for our AI voice agent solution.
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
