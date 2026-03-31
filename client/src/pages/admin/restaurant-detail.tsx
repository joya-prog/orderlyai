import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Edit2, Ban, CheckCircle, Trash2, LogIn, Save, X,
  Building2, Mail, Phone, Globe, Calendar, ShieldAlert,
  PhoneCall, Clock, DollarSign, BarChart2, LockOpen, Lock,
  UtensilsCrossed, HelpCircle, ChevronDown, ChevronUp, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

type Restaurant = User & { accountStatus: string };

function StatusBadge({ status }: { status: string | null }) {
  if (status === "active") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 no-default-active-elevate">Active</Badge>;
  if (status === "suspended") return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 no-default-active-elevate">Suspended</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 no-default-active-elevate">Trial</Badge>;
}

export default function AdminRestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<Partial<Restaurant>>({});

  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/admin/restaurants", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/restaurants/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: usageStats } = useQuery<{
    totalCalls: number;
    totalMinutes: number;
    totalCostCents: number;
    avgCostPerMinuteCents: number;
  }>({
    queryKey: ["/api/admin/restaurants", id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/restaurants/${id}/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!id,
  });

  const editMutation = useMutation({
    mutationFn: (data: Partial<Restaurant>) => apiRequest("PATCH", `/api/admin/restaurants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      toast({ title: "Saved" });
      setIsEditing(false);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (accountStatus: string) => apiRequest("PATCH", `/api/admin/restaurants/${id}/status`, { accountStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/restaurants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      toast({ title: "Account deleted" });
      navigate("/admin/restaurants");
    },
    onError: () => toast({ title: "Failed to delete account", variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/impersonate/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Now viewing as restaurant user" });
      navigate("/");
    },
    onError: () => toast({ title: "Failed to impersonate", variant: "destructive" }),
  });

  const [intakeExpanded, setIntakeExpanded] = useState(false);

  const unlockMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/restaurants/${id}/unlock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      toast({ title: "Dashboard unlocked", description: "The user can now access their dashboard." });
    },
    onError: () => toast({ title: "Failed to unlock dashboard", variant: "destructive" }),
  });

  function startEdit() {
    if (!restaurant) return;
    setForm({
      restaurantName: restaurant.restaurantName || "",
      restaurantType: restaurant.restaurantType || "",
      restaurantPhone: restaurant.restaurantPhone || "",
      restaurantWebsite: restaurant.restaurantWebsite || "",
      accountStatus: restaurant.accountStatus,
    });
    setIsEditing(true);
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>;
  }

  if (!restaurant) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Restaurant not found</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/restaurants")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{restaurant.restaurantName || "Unnamed Restaurant"}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">{restaurant.email}</p>
              <StatusBadge status={restaurant.accountStatus} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="default" onClick={() => impersonateMutation.mutate()} data-testid="button-login-as">
            <LogIn className="h-4 w-4 mr-2" />
            Login As
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => statusMutation.mutate(restaurant.accountStatus === "suspended" ? "active" : "suspended")}
            data-testid="button-toggle-status"
          >
            {restaurant.accountStatus === "suspended" ? (
              <><CheckCircle className="h-4 w-4 mr-2" />Activate</>
            ) : (
              <><Ban className="h-4 w-4 mr-2" />Suspend</>
            )}
          </Button>
          {!isEditing ? (
            <Button size="default" onClick={startEdit} data-testid="button-edit">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="default" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                <X className="h-4 w-4 mr-2" />Cancel
              </Button>
              <Button size="default" onClick={() => editMutation.mutate(form)} data-testid="button-save-edit">
                <Save className="h-4 w-4 mr-2" />Save
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Restaurant Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Restaurant Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-1.5">
                  <Label>Restaurant Name</Label>
                  <Input
                    value={form.restaurantName || ""}
                    onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))}
                    data-testid="input-restaurant-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Restaurant Type</Label>
                  <Select value={form.restaurantType || ""} onValueChange={v => setForm(f => ({ ...f, restaurantType: v }))}>
                    <SelectTrigger data-testid="select-restaurant-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fine_dining">Fine Dining</SelectItem>
                      <SelectItem value="casual_dining">Casual Dining</SelectItem>
                      <SelectItem value="fast_casual">Fast Casual</SelectItem>
                      <SelectItem value="cafe">Cafe</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="catering">Catering</SelectItem>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={form.restaurantPhone || ""}
                    onChange={e => setForm(f => ({ ...f, restaurantPhone: e.target.value }))}
                    data-testid="input-restaurant-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={form.restaurantWebsite || ""}
                    onChange={e => setForm(f => ({ ...f, restaurantWebsite: e.target.value }))}
                    data-testid="input-restaurant-website"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Status</Label>
                  <Select value={form.accountStatus || "trial"} onValueChange={v => setForm(f => ({ ...f, accountStatus: v }))}>
                    <SelectTrigger data-testid="select-account-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Name" value={restaurant.restaurantName || "—"} />
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Type" value={restaurant.restaurantType?.replace(/_/g, " ") || "—"} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={restaurant.restaurantPhone || "—"} />
                <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={restaurant.restaurantWebsite || "—"} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Account Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={restaurant.email || "—"} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Signed Up" value={restaurant.createdAt ? new Date(restaurant.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Auth Method</span>
              <Badge variant="outline" className="text-xs no-default-active-elevate">{restaurant.authProvider === "google" ? "Google" : "Email"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Onboarding</span>
              {restaurant.onboardingCompleted ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs no-default-active-elevate">Complete</Badge>
              ) : (
                <Badge variant="outline" className="text-xs no-default-active-elevate">Incomplete</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={restaurant.accountStatus} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Call Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Onboarding Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Dashboard Access</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {restaurant.onboardingCallUnlocked
                  ? "Dashboard is unlocked — user has full access."
                  : "Dashboard is locked until the setup call is completed."}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {restaurant.onboardingCallUnlocked ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 no-default-active-elevate gap-1.5" data-testid="badge-call-status">
                  <LockOpen className="h-3 w-3" />
                  Unlocked
                </Badge>
              ) : (
                <>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 no-default-active-elevate gap-1.5" data-testid="badge-call-status">
                    <Lock className="h-3 w-3" />
                    Awaiting Setup Call
                  </Badge>
                  <Button
                    size="default"
                    onClick={() => unlockMutation.mutate()}
                    disabled={unlockMutation.isPending}
                    data-testid="button-unlock-dashboard"
                  >
                    <LockOpen className="h-4 w-4 mr-2" />
                    {unlockMutation.isPending ? "Unlocking…" : "Unlock Dashboard"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Call Intake */}
      {(restaurant as any).preCallIntake && (
        <Card data-testid="card-pre-call-intake">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Pre-Call Intake
              </CardTitle>
              <button
                type="button"
                onClick={() => setIntakeExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-intake"
              >
                {intakeExpanded ? (
                  <><ChevronUp className="h-4 w-4" /> Collapse</>
                ) : (
                  <><ChevronDown className="h-4 w-4" /> View details</>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Submitted by the user after booking their setup call.
            </p>
          </CardHeader>
          {intakeExpanded && (
            <CardContent className="space-y-5 pt-0">
              {/* Hours */}
              {((restaurant as any).preCallIntake as any).businessHours && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Business Hours
                  </div>
                  <p className="text-sm text-muted-foreground pl-5">
                    {((restaurant as any).preCallIntake as any).businessHours}
                  </p>
                  {((restaurant as any).preCallIntake as any).timezone && (
                    <p className="text-xs text-muted-foreground pl-5">
                      Timezone: {((restaurant as any).preCallIntake as any).timezone}
                    </p>
                  )}
                </div>
              )}

              {/* Menu */}
              {((restaurant as any).preCallIntake as any).cuisineDescription && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                    Menu
                  </div>
                  <div className="pl-5 space-y-1.5">
                    <p className="text-sm text-muted-foreground">
                      {((restaurant as any).preCallIntake as any).cuisineDescription}
                    </p>
                    {((restaurant as any).preCallIntake as any).priceRange && (
                      <p className="text-xs text-muted-foreground">
                        Price range: {((restaurant as any).preCallIntake as any).priceRange.replace(/_/g, " ")}
                      </p>
                    )}
                    {((restaurant as any).preCallIntake as any).menuCategories?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground/70 mb-1">Categories</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(((restaurant as any).preCallIntake as any).menuCategories as string[]).map((c: string) => (
                            <Badge key={c} variant="secondary" className="text-xs no-default-active-elevate">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {((restaurant as any).preCallIntake as any).popularItems?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground/70 mb-1">Popular items</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(((restaurant as any).preCallIntake as any).popularItems as string[]).map((item: string) => (
                            <Badge key={item} variant="outline" className="text-xs no-default-active-elevate">{item}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FAQs */}
              {((restaurant as any).preCallIntake as any).faqs?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    Common Questions
                  </div>
                  <div className="pl-5 space-y-2">
                    {(((restaurant as any).preCallIntake as any).faqs as { question: string; answer: string }[]).map((faq, i) => (
                      faq.question ? (
                        <div key={i} className="rounded-lg border border-border/50 p-2.5 space-y-0.5">
                          <p className="text-xs font-medium text-foreground">{faq.question}</p>
                          {faq.answer && (
                            <p className="text-xs text-muted-foreground">{faq.answer}</p>
                          )}
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              {/* Policies */}
              {((restaurant as any).preCallIntake as any).policies && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Special Policies</p>
                  <p className="text-xs text-muted-foreground pl-0">
                    {((restaurant as any).preCallIntake as any).policies}
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Usage & Billing Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Usage & Billing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40">
                <PhoneCall className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Calls</p>
                <p className="text-xl font-bold" data-testid="stat-total-calls">{usageStats?.totalCalls ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Minutes</p>
                <p className="text-xl font-bold" data-testid="stat-total-minutes">{usageStats ? usageStats.totalMinutes.toFixed(1) : "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-xl font-bold" data-testid="stat-total-cost">{usageStats ? `$${(usageStats.totalCostCents / 100).toFixed(2)}` : "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40">
                <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Cost/Min</p>
                <p className="text-xl font-bold" data-testid="stat-avg-cost">{usageStats ? `$${(usageStats.avgCostPerMinuteCents / 100).toFixed(2)}` : "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Delete this account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently remove this restaurant and all associated data</p>
            </div>
            <Button variant="outline" size="default" className="border-destructive/50 text-destructive" onClick={() => setConfirmDelete(true)} data-testid="button-delete-account">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {restaurant.restaurantName || restaurant.email} and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteMutation.mutate()}
              data-testid="button-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-sm text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}
