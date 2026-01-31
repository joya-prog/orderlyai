import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User,
  CreditCard,
  Shield,
  Key,
  Bell,
  Check,
  Loader2,
  ExternalLink,
  FileText,
  Phone,
  Clock,
  Download,
  Calendar,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  AlertTriangle,
  Lock,
  Smartphone,
  Globe,
  Moon,
  Sun,
  Monitor,
  Wrench,
  Building2,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { Subscription, UsageMetric, Invoice, CallLog, User as UserType, UserPreferences, ApiKey } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BillingUsage {
  currentPeriodUsage: number;
  usageLimit: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
}

interface StripeConfig {
  publishableKey: string;
  hasStripeConnection: boolean;
}

interface TwoFactorStatus {
  isEnabled: boolean;
  hasBackupCodes: boolean;
  smsEnabled: boolean;
  phoneNumber: string | null;
  preferredMethod: 'totp' | 'sms';
}

interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

type SettingsTab = "preferences" | "billing" | "security" | "api-keys";

const BASE_MONTHLY_FEE = 149;
const USAGE_RATE_PER_MINUTE = 0.29;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get('checkout');
    if (checkoutResult === 'success') {
      toast({
        title: "Subscription activated",
        description: "Your subscription has been activated successfully.",
      });
      window.history.replaceState({}, '', '/settings');
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/usage'] });
    } else if (checkoutResult === 'canceled') {
      toast({
        title: "Checkout canceled",
        description: "You can subscribe anytime from this page.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/settings');
    }
  }, [toast]);

  const { data: subscription, isLoading: loadingSubscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: usageMetrics } = useQuery<UsageMetric>({
    queryKey: ["/api/usage-metrics"],
    enabled: !!subscription,
  });

  const { data: billingUsage, isLoading: loadingBillingUsage } = useQuery<BillingUsage>({
    queryKey: ["/api/billing/usage"],
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  const { data: callLogs = [], isLoading: loadingCallLogs } = useQuery<CallLog[]>({
    queryKey: ["/api/billing/call-logs"],
  });

  const { data: stripeConfig } = useQuery<StripeConfig>({
    queryKey: ["/api/billing/stripe-config"],
  });

  const createCheckoutSession = useMutation({
    mutationFn: async ({ planType }: { planType: string }) => {
      return await apiRequest<{ sessionId: string; url: string }>(
        'POST',
        '/api/billing/create-checkout-session',
        { planType }
      );
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  const createPortalSession = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ url: string }>(
        'POST',
        '/api/billing/create-portal-session',
        {}
      );
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to access billing portal",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = () => {
    createCheckoutSession.mutate({ planType: 'standard' });
  };

  const handleManageBilling = () => {
    createPortalSession.mutate();
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return 'N/A';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const menuItems = [
    { id: "preferences" as SettingsTab, label: "Preferences", icon: User },
    { id: "billing" as SettingsTab, label: "Plan & Billing", icon: CreditCard },
    { id: "security" as SettingsTab, label: "Security", icon: Shield },
    { id: "api-keys" as SettingsTab, label: "API Keys", icon: Key },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="md:hidden border-b bg-muted/30">
        <div className="flex flex-wrap gap-2 p-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "hover-elevate text-foreground bg-background"
              }`}
              data-testid={`settings-tab-${item.id}`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:block w-64 border-r bg-muted/30 p-6 space-y-1">
        <h2 className="text-lg font-bold tracking-tight mb-4">Settings</h2>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
              activeTab === item.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover-elevate text-foreground"
            }`}
            data-testid={`settings-tab-${item.id}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "preferences" && <PreferencesTab />}
        {activeTab === "billing" && (
          <BillingTab
            subscription={subscription}
            loadingSubscription={loadingSubscription}
            usageMetrics={usageMetrics}
            billingUsage={billingUsage}
            invoices={invoices}
            loadingInvoices={loadingInvoices}
            callLogs={callLogs}
            loadingCallLogs={loadingCallLogs}
            handleSubscribe={handleSubscribe}
            handleManageBilling={handleManageBilling}
            createCheckoutSession={createCheckoutSession}
            createPortalSession={createPortalSession}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "api-keys" && <ApiKeysTab />}
      </div>
    </div>
  );
}

function PreferencesTab() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/preferences"],
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [language, setLanguage] = useState("en");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setPhoneNumber((user as any).phoneNumber || "");
      setRestaurantName((user as any).restaurantName || "");
    }
  }, [user]);

  useEffect(() => {
    if (preferences) {
      setTimezone(preferences.timezone || "America/New_York");
      setLanguage(preferences.language || "en");
      setEmailNotifications(preferences.emailNotifications ?? true);
      setSmsNotifications(preferences.smsNotifications ?? false);
      setMarketingEmails(preferences.marketingEmails ?? false);
      setWeeklyDigest(preferences.weeklyDigest ?? true);
    }
  }, [preferences]);

  const updateProfile = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phoneNumber?: string; restaurantName?: string }) => {
      return await apiRequest('PATCH', '/api/auth/profile', data);
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your profile has been saved." });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    },
  });

  const updatePreferences = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      return await apiRequest('PATCH', '/api/preferences', data);
    },
    onSuccess: () => {
      toast({ title: "Preferences saved", description: "Your preferences have been updated." });
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save preferences", variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({ firstName, lastName, email, phoneNumber, restaurantName });
  };

  const handleSavePreferences = () => {
    updatePreferences.mutate({
      timezone,
      language,
      emailNotifications,
      smsNotifications,
      marketingEmails,
      weeklyDigest,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8" data-testid="settings-preferences">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Preferences</h1>
        <p className="text-muted-foreground">Manage your profile and application settings</p>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal and business details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              data-testid="input-phone-number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="restaurantName">Restaurant Name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="restaurantName"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="Enter your restaurant name"
                className="pl-10"
                data-testid="input-restaurant-name"
              />
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={updateProfile.isPending}
            data-testid="button-save-profile"
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regional Settings
          </CardTitle>
          <CardDescription>Configure timezone and language preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger data-testid="select-language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : theme === "light" ? <Sun className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            Appearance
          </CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {[
                { value: "light" as const, icon: Sun, label: "Light" },
                { value: "dark" as const, icon: Moon, label: "Dark" },
                { value: "system" as const, icon: Monitor, label: "System" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setTheme(option.value)}
                  data-testid={`button-theme-${option.value}`}
                >
                  <option.icon className="h-4 w-4 mr-2" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Manage how you receive updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Email Notifications</div>
              <div className="text-sm text-muted-foreground">Receive updates via email</div>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              data-testid="switch-email-notifications"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">SMS Notifications</div>
              <div className="text-sm text-muted-foreground">Get text alerts for important events</div>
            </div>
            <Switch
              checked={smsNotifications}
              onCheckedChange={setSmsNotifications}
              data-testid="switch-sms-notifications"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Marketing Emails</div>
              <div className="text-sm text-muted-foreground">News about new features and updates</div>
            </div>
            <Switch
              checked={marketingEmails}
              onCheckedChange={setMarketingEmails}
              data-testid="switch-marketing-emails"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Weekly Digest</div>
              <div className="text-sm text-muted-foreground">Summary of your agent activity</div>
            </div>
            <Switch
              checked={weeklyDigest}
              onCheckedChange={setWeeklyDigest}
              data-testid="switch-weekly-digest"
            />
          </div>
          <div className="pt-4">
            <Button
              onClick={handleSavePreferences}
              disabled={updatePreferences.isPending}
              data-testid="button-save-preferences"
            >
              {updatePreferences.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      <DangerZoneSection email={email} />
    </div>
  );
}

function DangerZoneSection({ email }: { email: string }) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const deleteAccount = useMutation({
    mutationFn: async (data: { confirmEmail: string }) => {
      return await apiRequest('DELETE', '/api/auth/account', data);
    },
    onSuccess: () => {
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete account", variant: "destructive" });
    },
  });

  return (
    <Card className="shadow-md border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible actions for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg">
          <div>
            <div className="font-medium">Delete Account</div>
            <div className="text-sm text-muted-foreground">
              Permanently delete your account, cancel billing, and remove all data
            </div>
          </div>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-account">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Delete Your Account
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your account, cancel any active subscription and billing, and remove all your agents, knowledge bases, contacts, and data.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="confirmEmail">Type your email to confirm: <span className="font-mono text-sm">{email}</span></Label>
                  <Input
                    id="confirmEmail"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder="Enter your email"
                    data-testid="input-confirm-email-delete"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteAccount.mutate({ confirmEmail })}
                  disabled={confirmEmail !== email || deleteAccount.isPending}
                  data-testid="button-confirm-delete-account"
                >
                  {deleteAccount.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete My Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  
  // SMS 2FA state
  const [showSmsSetup, setShowSmsSetup] = useState(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState("");
  const [smsVerifyCode, setSmsVerifyCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const { data: twoFactorStatus, isLoading: loading2FA } = useQuery<TwoFactorStatus>({
    queryKey: ["/api/auth/2fa/status"],
  });

  const changePassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('POST', '/api/auth/change-password', data);
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to change password", variant: "destructive" });
    },
  });

  const setup2FA = useMutation({
    mutationFn: async () => {
      return await apiRequest<TwoFactorSetup>('POST', '/api/auth/2fa/setup', {});
    },
    onSuccess: (data) => {
      setSetupData(data);
      setShowSetup2FA(true);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to setup 2FA", variant: "destructive" });
    },
  });

  const enable2FA = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest('POST', '/api/auth/2fa/enable', { code });
    },
    onSuccess: () => {
      toast({ title: "2FA Enabled", description: "Two-factor authentication is now active on your account." });
      setShowSetup2FA(false);
      setTwoFactorCode("");
      setSetupData(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/2fa/status'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to enable 2FA", variant: "destructive" });
    },
  });

  const disable2FA = useMutation({
    mutationFn: async (password: string) => {
      return await apiRequest('POST', '/api/auth/2fa/disable', { password });
    },
    onSuccess: () => {
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been removed." });
      setDisablePassword("");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/2fa/status'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to disable 2FA", variant: "destructive" });
    },
  });

  const setupSms2FA = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest<{ message: string; phoneLastFour: string }>('POST', '/api/auth/2fa/sms/setup', { phoneNumber });
    },
    onSuccess: () => {
      setSmsSent(true);
      toast({ title: "Code Sent", description: "A verification code has been sent to your phone." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send verification code", variant: "destructive" });
    },
  });

  const verifySms2FA = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest('POST', '/api/auth/2fa/sms/verify', { code });
    },
    onSuccess: () => {
      toast({ title: "SMS 2FA Enabled", description: "SMS two-factor authentication is now active." });
      setShowSmsSetup(false);
      setSmsSent(false);
      setSmsPhoneNumber("");
      setSmsVerifyCode("");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/2fa/status'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Invalid verification code", variant: "destructive" });
    },
  });

  const updatePreferredMethod = useMutation({
    mutationFn: async (method: 'totp' | 'sms') => {
      return await apiRequest('POST', '/api/auth/2fa/preferred-method', { method });
    },
    onSuccess: (_, method) => {
      toast({ title: "Preferred Method Updated", description: `Your preferred 2FA method is now ${method === 'totp' ? 'authenticator app' : 'SMS'}.` });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/2fa/status'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update preferred method", variant: "destructive" });
    },
  });

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  const handleEnable2FA = () => {
    enable2FA.mutate(twoFactorCode);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Copied to clipboard" });
  };

  const isGoogleOnly = user?.authProvider === 'google' && !user?.passwordHash;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8" data-testid="settings-security">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Security</h1>
        <p className="text-muted-foreground">Manage your password and account security</p>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            {isGoogleOnly
              ? "Set a password to enable email/password login"
              : "Change your account password"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPasswordChange ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isGoogleOnly 
                  ? "You're signed in with Google. Set a password to also log in with email."
                  : "Last changed: Never"}
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowPasswordChange(true)}
                data-testid="button-initiate-password-change"
              >
                {isGoogleOnly ? "Set Password" : "Change Password"}
              </Button>
            </div>
          ) : (
            <>
              {!isGoogleOnly && (
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      data-testid="input-current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={changePassword.isPending || (!isGoogleOnly && !currentPassword) || !newPassword || !confirmPassword}
                  data-testid="button-change-password"
                >
                  {changePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isGoogleOnly ? "Set Password" : "Update Password"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPasswordChange(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  data-testid="button-cancel-password-change"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading2FA ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : twoFactorStatus?.isEnabled ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-500/10 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-green-700 dark:text-green-400 font-medium">Two-factor authentication is enabled</span>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm font-medium">Verification Methods</div>
                
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${twoFactorStatus.preferredMethod === 'totp' ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Authenticator App</div>
                        <div className="text-sm text-muted-foreground">Use Google Authenticator or similar</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {twoFactorStatus.preferredMethod === 'totp' && (
                        <Badge variant="secondary">Primary</Badge>
                      )}
                      {twoFactorStatus.preferredMethod !== 'totp' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updatePreferredMethod.mutate('totp')}
                          disabled={updatePreferredMethod.isPending}
                          data-testid="button-set-totp-primary"
                        >
                          Set as Primary
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-between p-3 border rounded-lg ${twoFactorStatus.preferredMethod === 'sms' ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">SMS Text Message</div>
                        <div className="text-sm text-muted-foreground">
                          {twoFactorStatus.smsEnabled && twoFactorStatus.phoneNumber 
                            ? `Receive codes at ${twoFactorStatus.phoneNumber}` 
                            : 'Not set up'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {twoFactorStatus.smsEnabled ? (
                        <>
                          {twoFactorStatus.preferredMethod === 'sms' && (
                            <Badge variant="secondary">Primary</Badge>
                          )}
                          {twoFactorStatus.preferredMethod !== 'sms' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => updatePreferredMethod.mutate('sms')}
                              disabled={updatePreferredMethod.isPending}
                              data-testid="button-set-sms-primary"
                            >
                              Set as Primary
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowSmsSetup(true)}
                          data-testid="button-add-sms"
                        >
                          Add Phone
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {showSmsSetup && (
                <div className="p-4 bg-muted rounded-lg space-y-4">
                  <div className="text-sm font-medium">Add SMS Verification</div>
                  {!smsSent ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Phone number (e.g., 555-123-4567)"
                        value={smsPhoneNumber}
                        onChange={(e) => setSmsPhoneNumber(e.target.value)}
                        data-testid="input-sms-phone"
                      />
                      <Button 
                        onClick={() => setupSms2FA.mutate(smsPhoneNumber)}
                        disabled={setupSms2FA.isPending || !smsPhoneNumber}
                        data-testid="button-send-sms-code"
                      >
                        {setupSms2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Send Code
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">Enter the 6-digit code sent to your phone</div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="000000"
                          value={smsVerifyCode}
                          onChange={(e) => setSmsVerifyCode(e.target.value)}
                          maxLength={6}
                          data-testid="input-sms-verify-code"
                        />
                        <Button 
                          onClick={() => verifySms2FA.mutate(smsVerifyCode)}
                          disabled={verifySms2FA.isPending || smsVerifyCode.length !== 6}
                          data-testid="button-verify-sms"
                        >
                          {verifySms2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Verify
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto text-primary underline-offset-4 hover:underline"
                        onClick={() => setupSms2FA.mutate(smsPhoneNumber)}
                        disabled={setupSms2FA.isPending}
                      >
                        Resend code
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setShowSmsSetup(false); setSmsSent(false); setSmsPhoneNumber(""); setSmsVerifyCode(""); }}>
                    Cancel
                  </Button>
                </div>
              )}
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-disable-2fa">
                    Disable 2FA
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the extra security layer from your account. Enter your password to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    data-testid="input-disable-2fa-password"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disable2FA.mutate(disablePassword)}
                      disabled={disable2FA.isPending}
                    >
                      {disable2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Disable
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : showSetup2FA && setupData ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">1. Scan this QR code with your authenticator app</div>
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.otpauthUrl)}`}
                      alt="2FA QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Or enter this code manually:</div>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-3 py-2 rounded text-sm font-mono">{setupData.secret}</code>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(setupData.secret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">2. Save your backup codes:</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {setupData.backupCodes.map((code, i) => (
                      <code key={i} className="bg-background px-2 py-1 rounded text-xs font-mono text-center">{code}</code>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Store these codes in a safe place. Each can only be used once.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>3. Enter verification code from your app</Label>
                <div className="flex gap-2">
                  <Input
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    data-testid="input-2fa-code"
                  />
                  <Button
                    onClick={handleEnable2FA}
                    disabled={enable2FA.isPending || twoFactorCode.length !== 6}
                    data-testid="button-verify-2fa"
                  >
                    {enable2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Verify & Enable
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => { setShowSetup2FA(false); setSetupData(null); }}>
                Cancel Setup
              </Button>
            </div>
          ) : showSmsSetup ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div className="text-sm font-medium">Setup SMS Verification</div>
                {!smsSent ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">Enter your phone number to receive verification codes via SMS</div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Phone number (e.g., 555-123-4567)"
                        value={smsPhoneNumber}
                        onChange={(e) => setSmsPhoneNumber(e.target.value)}
                        data-testid="input-sms-phone-setup"
                      />
                      <Button 
                        onClick={() => setupSms2FA.mutate(smsPhoneNumber)}
                        disabled={setupSms2FA.isPending || !smsPhoneNumber}
                        data-testid="button-send-sms-code-setup"
                      >
                        {setupSms2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Send Code
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">Enter the 6-digit code sent to your phone</div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="000000"
                        value={smsVerifyCode}
                        onChange={(e) => setSmsVerifyCode(e.target.value)}
                        maxLength={6}
                        data-testid="input-sms-verify-code-setup"
                      />
                      <Button 
                        onClick={() => verifySms2FA.mutate(smsVerifyCode)}
                        disabled={verifySms2FA.isPending || smsVerifyCode.length !== 6}
                        data-testid="button-verify-sms-setup"
                      >
                        {verifySms2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Verify & Enable
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto text-primary underline-offset-4 hover:underline"
                      onClick={() => setupSms2FA.mutate(smsPhoneNumber)}
                      disabled={setupSms2FA.isPending}
                    >
                      Resend code
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => { setShowSmsSetup(false); setSmsSent(false); setSmsPhoneNumber(""); setSmsVerifyCode(""); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-amber-700 dark:text-amber-400">Two-factor authentication is not enabled</span>
              </div>
              <div className="text-sm text-muted-foreground mb-4">Choose how you want to verify your identity when logging in:</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => setup2FA.mutate()} disabled={setup2FA.isPending} data-testid="button-setup-2fa" className="flex-1">
                  <Smartphone className="h-4 w-4 mr-2" />
                  {setup2FA.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Authenticator App
                </Button>
                <Button onClick={() => setShowSmsSetup(true)} variant="outline" data-testid="button-setup-sms" className="flex-1">
                  <Phone className="h-4 w-4 mr-2" />
                  SMS Text Message
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApiKeysTab() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto" data-testid="settings-api-keys">
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-500/20 mb-6">
          <Wrench className="h-12 w-12 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">API Dashboard Under Maintenance</h1>
        <p className="text-muted-foreground max-w-md">
          We're currently enhancing this section to provide a better experience. Thank you for your patience.
        </p>
      </div>
    </div>
  );
}

interface BillingTabProps {
  subscription: Subscription | undefined;
  loadingSubscription: boolean;
  usageMetrics: UsageMetric | undefined;
  billingUsage: BillingUsage | undefined;
  invoices: Invoice[];
  loadingInvoices: boolean;
  callLogs: CallLog[];
  loadingCallLogs: boolean;
  handleSubscribe: () => void;
  handleManageBilling: () => void;
  createCheckoutSession: any;
  createPortalSession: any;
  formatDate: (dateStr: string | Date | null) => string;
  formatCurrency: (amount: string | number | null) => string;
}

function BillingTab({
  subscription,
  loadingSubscription,
  usageMetrics,
  billingUsage,
  invoices,
  loadingInvoices,
  callLogs,
  loadingCallLogs,
  handleSubscribe,
  handleManageBilling,
  createCheckoutSession,
  createPortalSession,
  formatDate,
  formatCurrency,
}: BillingTabProps) {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8" data-testid="settings-billing">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-section-title">
          Plan & Billing
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing information
        </p>
      </div>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0 pb-4">
          <div>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your active subscription details</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {subscription?.stripeCustomerId && (
              <Button 
                variant="outline" 
                onClick={handleManageBilling}
                disabled={createPortalSession.isPending}
                data-testid="button-manage-billing"
              >
                {createPortalSession.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Billing
              </Button>
            )}
            <Button variant="outline" data-testid="button-add-payment-method">
              <CreditCard className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSubscription ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : subscription ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Subscription</div>
                <div className="font-semibold text-lg">
                  ${BASE_MONTHLY_FEE}/month
                </div>
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                  {subscription.status}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Minutes This Period</div>
                <div className="font-semibold text-lg">
                  {billingUsage ? Math.round(billingUsage.currentPeriodUsage) : usageMetrics?.minutesUsed || '0'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  at ${USAGE_RATE_PER_MINUTE}/min
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Est. Usage Cost</div>
                <div className="font-semibold text-lg">
                  ${((billingUsage?.currentPeriodUsage || parseInt(usageMetrics?.minutesUsed || '0')) * USAGE_RATE_PER_MINUTE).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  this billing period (est.)
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Active Agents</div>
                <div className="font-semibold text-lg">
                  {usageMetrics?.activeAgents || '0'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {usageMetrics?.activePhoneNumbers || '0'} phone numbers
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No subscription found. Choose a plan below to get started.
            </div>
          )}
          
          {billingUsage && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Billing period: {formatDate(billingUsage.periodStart)} - {formatDate(billingUsage.periodEnd)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Recent Call Activity
            </CardTitle>
            <CardDescription>Your latest billable calls</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCallLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : callLogs.length > 0 ? (
            <div className="space-y-3">
              {callLogs.slice(0, 5).map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${call.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {call.fromNumber || 'Unknown'} → {call.toNumber || 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {call.durationMinutes || Math.ceil((parseInt(call.duration || '0')) / 60)} min
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(call.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No call activity yet</p>
              <p className="text-sm">Your call history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice History
            </CardTitle>
            <CardDescription>Your billing history and invoices</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        Invoice #{invoice.stripeInvoiceId?.slice(-8) || invoice.id.slice(-8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(invoice.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(invoice.amountDue)}</div>
                      <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'open' ? 'secondary' : 'destructive'} className="text-xs">
                        {invoice.status}
                      </Badge>
                    </div>
                    {invoice.hostedInvoiceUrl && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-sm">Your invoices will appear here once you subscribe</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
