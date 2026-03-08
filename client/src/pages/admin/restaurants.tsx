import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Download, MoreVertical, Eye, Edit2, Ban, CheckCircle, Trash2,
  LogIn, RefreshCw, ShieldCheck, Users, TrendingUp, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function AuthBadge({ provider }: { provider: string | null }) {
  if (provider === "google") return <Badge variant="outline" className="text-xs no-default-active-elevate">Google</Badge>;
  return <Badge variant="outline" className="text-xs no-default-active-elevate">Email</Badge>;
}

function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  if (firstName || lastName) return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  return email?.[0]?.toUpperCase() || "U";
}

export default function AdminRestaurants() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{ type: string; user: Restaurant } | null>(null);

  const { data: restaurants = [], isLoading, refetch } = useQuery<Restaurant[]>({
    queryKey: ["/api/admin/restaurants"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, accountStatus }: { id: string; accountStatus: string }) =>
      apiRequest("PATCH", `/api/admin/restaurants/${id}/status`, { accountStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      toast({ title: "Status updated" });
      setConfirmAction(null);
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/restaurants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      toast({ title: "Account deleted" });
      setConfirmAction(null);
    },
    onError: () => toast({ title: "Failed to delete account", variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/impersonate/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Now viewing as restaurant user" });
      navigate("/");
    },
    onError: () => toast({ title: "Failed to impersonate", variant: "destructive" }),
  });

  const filtered = restaurants.filter(r => {
    const matchSearch = !search ||
      r.restaurantName?.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.accountStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: restaurants.length,
    active: restaurants.filter(r => r.accountStatus === "active").length,
    trial: restaurants.filter(r => r.accountStatus === "trial").length,
    suspended: restaurants.filter(r => r.accountStatus === "suspended").length,
  };

  function handleExport() {
    window.location.href = "/api/admin/restaurants/export";
  }

  function confirmSuspend(user: Restaurant) {
    const newStatus = user.accountStatus === "suspended" ? "active" : "suspended";
    setConfirmAction({ type: newStatus === "suspended" ? "suspend" : "activate", user });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Restaurant Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all restaurants on the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="default" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="default" onClick={handleExport} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold" data-testid="stat-total">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold" data-testid="stat-active">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trial</p>
                <p className="text-xl font-bold" data-testid="stat-trial">{stats.trial}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40">
                <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Suspended</p>
                <p className="text-xl font-bold" data-testid="stat-suspended">{stats.suspended}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search-restaurants"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">
            {filtered.length} restaurant{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No restaurants found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Restaurant</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Auth</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Signup</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover-elevate" data-testid={`row-restaurant-${r.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={r.profileImageUrl || undefined} />
                            <AvatarFallback className="text-xs bg-muted">
                              {getInitials(r.firstName, r.lastName, r.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate" data-testid={`text-restaurant-name-${r.id}`}>
                              {r.restaurantName || "Unnamed"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.restaurantType?.replace(/_/g, " ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="truncate max-w-48">{r.email}</p>
                        <p className="text-xs text-muted-foreground">{r.restaurantPhone || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.accountStatus} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <AuthBadge provider={r.authProvider} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${r.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/restaurants/${r.id}`)} data-testid={`action-view-${r.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/admin/restaurants/${r.id}?edit=true`)} data-testid={`action-edit-${r.id}`}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => impersonateMutation.mutate(r.id)}
                              data-testid={`action-impersonate-${r.id}`}
                            >
                              <LogIn className="h-4 w-4 mr-2" />
                              Login As
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => confirmSuspend(r)}
                              data-testid={`action-suspend-${r.id}`}
                            >
                              {r.accountStatus === "suspended" ? (
                                <><CheckCircle className="h-4 w-4 mr-2" />Activate</>
                              ) : (
                                <><Ban className="h-4 w-4 mr-2" />Suspend</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setConfirmAction({ type: "delete", user: r })}
                              data-testid={`action-delete-${r.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" && "Delete Account"}
              {confirmAction?.type === "suspend" && "Suspend Account"}
              {confirmAction?.type === "activate" && "Activate Account"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete" && `This will permanently delete ${confirmAction.user.restaurantName || confirmAction.user.email} and all their data. This cannot be undone.`}
              {confirmAction?.type === "suspend" && `Suspending ${confirmAction.user.restaurantName || confirmAction.user.email} will prevent them from accessing the platform.`}
              {confirmAction?.type === "activate" && `Reactivating ${confirmAction.user.restaurantName || confirmAction.user.email} will restore their access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "delete") {
                  deleteMutation.mutate(confirmAction.user.id);
                } else {
                  statusMutation.mutate({
                    id: confirmAction.user.id,
                    accountStatus: confirmAction.type === "suspend" ? "suspended" : "active",
                  });
                }
              }}
              className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground" : ""}
              data-testid="button-confirm-action"
            >
              {confirmAction?.type === "delete" ? "Delete" : confirmAction?.type === "suspend" ? "Suspend" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
