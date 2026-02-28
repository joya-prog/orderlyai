import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type PhoneNumber, type Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Plus,
  Trash2,
  Search,
  Link2,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  MessageSquare,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const searchSchema = z.object({
  areaCode: z.string().min(3, "Area code must be at least 3 digits"),
  country: z.string().default("US"),
});

const sipTrunkSchema = z.object({
  phoneNumber: z.string().min(10, "Enter a valid phone number"),
  friendlyName: z.string().optional(),
  sipDomain: z.string().optional(),
  sipAuthType: z.enum(["credentials", "ip_acl"]).default("credentials"),
  sipUsername: z.string().optional(),
  sipPassword: z.string().optional(),
  ipAddresses: z.string().optional(),
});

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  capabilities: { voice?: boolean; sms?: boolean };
}

type AddStep = "choose" | "purchase-search" | "purchase-results" | "sip";

export default function PhoneNumbersPage() {
  const [addStep, setAddStep] = useState<AddStep | null>(null);
  const [deletingNumber, setDeletingNumber] = useState<PhoneNumber | null>(null);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [showAdvancedSip, setShowAdvancedSip] = useState(false);
  const { toast } = useToast();

  const { data: phoneNumbers = [], isLoading: numbersLoading } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: { areaCode: "", country: "US" },
  });

  const sipForm = useForm<z.infer<typeof sipTrunkSchema>>({
    resolver: zodResolver(sipTrunkSchema),
    defaultValues: {
      phoneNumber: "",
      friendlyName: "",
      sipDomain: "",
      sipAuthType: "credentials",
      sipUsername: "",
      sipPassword: "",
      ipAddresses: "",
    },
  });

  const searchMutation = useMutation({
    mutationFn: (data: z.infer<typeof searchSchema>) =>
      apiRequest("POST", "/api/phone-numbers/search", data),
    onSuccess: (data: AvailableNumber[]) => {
      setAvailableNumbers(data);
      setAddStep("purchase-results");
      if (data.length === 0) {
        toast({ title: "No numbers found", description: "Try a different area code" });
        setAddStep("purchase-search");
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Search failed", description: error.message });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; friendlyName: string }) =>
      apiRequest("POST", "/api/phone-numbers/purchase", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setAddStep(null);
      setAvailableNumbers([]);
      setSelectedNumber(null);
      searchForm.reset();
      toast({ title: "Number added!", description: "Your new phone number is ready to use." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Purchase failed", description: error.message });
    },
  });

  const sipTrunkMutation = useMutation({
    mutationFn: (data: z.infer<typeof sipTrunkSchema>) =>
      apiRequest("POST", "/api/phone-numbers/sip-trunk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setAddStep(null);
      sipForm.reset();
      toast({ title: "Number connected!", description: "Your phone number has been connected via SIP trunk." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Connection failed", description: error.message });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string | null }) =>
      apiRequest("PATCH", `/api/phone-numbers/${id}`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({ title: "Agent assigned", description: "Phone number assignment updated." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/phone-numbers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setDeletingNumber(null);
      toast({ title: "Number released", description: "Phone number removed from your account." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Release failed", description: error.message });
    },
  });

  const sipAuthType = sipForm.watch("sipAuthType");

  const resetDialog = () => {
    setAddStep(null);
    setAvailableNumbers([]);
    setSelectedNumber(null);
    setShowAdvancedSip(false);
    searchForm.reset();
    sipForm.reset();
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Phone Numbers</h1>
          <p className="text-sm text-muted-foreground">
            Connect a phone number so customers can call your AI agent
          </p>
        </div>
        <Button onClick={() => setAddStep("choose")} data-testid="button-add-number">
          <Plus className="mr-2 h-4 w-4" />
          Add Number
        </Button>
      </div>

      {numbersLoading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            Loading phone numbers...
          </CardContent>
        </Card>
      ) : phoneNumbers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Phone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-numbers">
              No phone numbers yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Add a phone number so your AI agent can receive calls from customers.
            </p>
            <Button onClick={() => setAddStep("choose")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Number
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Number</TableHead>
                <TableHead className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Type</TableHead>
                <TableHead className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Friendly Name</TableHead>
                <TableHead className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Assigned Agent</TableHead>
                <TableHead className="text-xs uppercase tracking-wide font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide font-medium text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.map((phoneNumber) => (
                <TableRow key={phoneNumber.id} className="h-14" data-testid={`row-phone-${phoneNumber.id}`}>
                  <TableCell className="font-medium">{phoneNumber.number}</TableCell>
                  <TableCell>
                    <Badge
                      variant={phoneNumber.connectionType === "sip_trunk" ? "outline" : "secondary"}
                      className="gap-1 text-xs"
                      data-testid={`connection-type-${phoneNumber.id}`}
                    >
                      {phoneNumber.connectionType === "sip_trunk" ? (
                        <><Link2 className="h-3 w-3" />SIP Trunk</>
                      ) : (
                        <><ShoppingCart className="h-3 w-3" />Purchased</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {phoneNumber.friendlyName || "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={phoneNumber.agentId || "unassigned"}
                      onValueChange={(v) => assignMutation.mutate({ id: phoneNumber.id, agentId: v === "unassigned" ? null : v })}
                      disabled={assignMutation.isPending}
                    >
                      <SelectTrigger className="w-[180px]" data-testid={`select-agent-${phoneNumber.id}`}>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id} data-testid={`option-agent-${agent.id}`}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-testid={`status-${phoneNumber.id}`}>
                      {phoneNumber.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingNumber(phoneNumber)}
                      data-testid={`button-delete-phone-${phoneNumber.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Main Add Number Dialog */}
      <Dialog open={addStep !== null} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-w-xl" data-testid="dialog-add-phone">

          {/* Step: Choose connection type */}
          {addStep === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Add a Phone Number</DialogTitle>
                <DialogDescription>
                  Choose how you want to connect a number to your AI agent
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setAddStep("purchase-search")}
                  className="flex items-start gap-4 p-5 rounded-lg border-2 border-muted text-left hover-elevate transition-all"
                  data-testid="button-choose-purchase"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">Get a new number</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Search and buy a phone number directly through Twilio. Easiest option — ready in seconds.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setAddStep("sip")}
                  className="flex items-start gap-4 p-5 rounded-lg border-2 border-muted text-left hover-elevate transition-all"
                  data-testid="button-choose-sip"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">Use your existing number</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Already have a number with another provider? Connect it via SIP so calls route to your AI agent.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
                </button>
              </div>
            </>
          )}

          {/* Step: Purchase — Search */}
          {addStep === "purchase-search" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAddStep("choose")}
                    className="h-7 w-7"
                    data-testid="button-back-choose"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle>Search for a Number</DialogTitle>
                </div>
                <DialogDescription>
                  Enter an area code to find available local numbers
                </DialogDescription>
              </DialogHeader>
              <Form {...searchForm}>
                <form
                  onSubmit={searchForm.handleSubmit((values) => searchMutation.mutate(values))}
                  className="space-y-4 mt-1"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={searchForm.control}
                      name="areaCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. 415, 212"
                              data-testid="input-area-code"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={searchForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-country">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="US">United States</SelectItem>
                              <SelectItem value="CA">Canada</SelectItem>
                              <SelectItem value="GB">United Kingdom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={searchMutation.isPending}
                      className="w-full"
                      data-testid="button-search-numbers"
                    >
                      {searchMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</>
                      ) : (
                        <><Search className="mr-2 h-4 w-4" />Search Numbers</>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}

          {/* Step: Purchase — Results */}
          {addStep === "purchase-results" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setAvailableNumbers([]); setAddStep("purchase-search"); }}
                    className="h-7 w-7"
                    data-testid="button-back-search"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle>Available Numbers</DialogTitle>
                </div>
                <DialogDescription>
                  {availableNumbers.length} numbers found — click one to select it
                </DialogDescription>
              </DialogHeader>

              {selectedNumber ? (
                <div className="space-y-4 mt-1">
                  <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-primary bg-primary/5">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">{selectedNumber.phoneNumber}</p>
                      <div className="flex gap-3 mt-1">
                        {selectedNumber.capabilities?.voice && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mic className="h-3 w-3" />Voice
                          </span>
                        )}
                        {selectedNumber.capabilities?.sms && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />SMS
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedNumber(null)}
                    >
                      Change
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => purchaseMutation.mutate({
                        phoneNumber: selectedNumber.phoneNumber,
                        friendlyName: selectedNumber.phoneNumber,
                      })}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-confirm-purchase"
                    >
                      {purchaseMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding number...</>
                      ) : (
                        <>Get {selectedNumber.phoneNumber}</>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 mt-1">
                  {availableNumbers.map((num) => (
                    <button
                      key={num.phoneNumber}
                      type="button"
                      onClick={() => setSelectedNumber(num)}
                      className="w-full flex items-center justify-between p-3.5 rounded-lg border border-border text-left hover-elevate transition-all"
                      data-testid={`available-number-${num.phoneNumber}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{num.phoneNumber}</p>
                        <div className="flex gap-3 mt-0.5">
                          {num.capabilities?.voice && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mic className="h-3 w-3" />Voice
                            </span>
                          )}
                          {num.capabilities?.sms && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />SMS
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step: SIP Trunk */}
          {addStep === "sip" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAddStep("choose")}
                    className="h-7 w-7"
                    data-testid="button-back-sip"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle>Connect Your Existing Number</DialogTitle>
                </div>
                <DialogDescription>
                  We'll create a SIP trunk so calls to your number route through your AI agent
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground mt-1">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">How it works:</strong> We configure a special connection (SIP trunk) between your existing phone carrier and Orderly AI. When someone calls your number, the call is routed to your AI agent automatically. Your carrier must support SIP trunking.
                </p>
              </div>

              <Form {...sipForm}>
                <form
                  onSubmit={sipForm.handleSubmit((values) => sipTrunkMutation.mutate(values))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={sipForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Phone Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+1 (555) 123-4567"
                              data-testid="input-sip-phone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={sipForm.control}
                      name="friendlyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Main Line"
                              data-testid="input-sip-friendly-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Collapsible open={showAdvancedSip} onOpenChange={setShowAdvancedSip}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 px-0 text-muted-foreground"
                        data-testid="button-toggle-advanced"
                      >
                        {showAdvancedSip ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Advanced SIP settings
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-2">
                      <FormField
                        control={sipForm.control}
                        name="sipDomain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom SIP Domain <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                            <FormControl>
                              <Input
                                placeholder="myrestaurant.sip.twilio.com"
                                data-testid="input-sip-domain"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Leave empty to auto-generate a Twilio SIP domain</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={sipForm.control}
                        name="sipAuthType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Authentication Method</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-sip-auth">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="credentials">Username & Password</SelectItem>
                                <SelectItem value="ip_acl">IP Address Whitelist</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {sipAuthType === "credentials" && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={sipForm.control}
                            name="sipUsername"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SIP Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="sip_user" data-testid="input-sip-username" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={sipForm.control}
                            name="sipPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SIP Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••" data-testid="input-sip-password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                      {sipAuthType === "ip_acl" && (
                        <FormField
                          control={sipForm.control}
                          name="ipAddresses"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Allowed IP Addresses</FormLabel>
                              <FormControl>
                                <Input placeholder="192.168.1.1, 10.0.0.1" data-testid="input-ip-addresses" {...field} />
                              </FormControl>
                              <FormDescription>Comma-separated list of IPs to whitelist</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={sipTrunkMutation.isPending}
                      className="w-full"
                      data-testid="button-connect-sip"
                    >
                      {sipTrunkMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
                      ) : (
                        <><Link2 className="mr-2 h-4 w-4" />Connect Number</>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingNumber} onOpenChange={() => setDeletingNumber(null)}>
        <DialogContent data-testid="dialog-delete-phone">
          <DialogHeader>
            <DialogTitle>
              {deletingNumber?.connectionType === "sip_trunk"
                ? "Disconnect Number"
                : "Release Number"}
            </DialogTitle>
            <DialogDescription>
              {deletingNumber?.connectionType === "sip_trunk"
                ? `Disconnect ${deletingNumber?.number} from SIP trunk? The trunk configuration will be removed.`
                : `Release ${deletingNumber?.number}? This cannot be undone — the number returns to Twilio's pool.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingNumber(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingNumber && deleteMutation.mutate(deletingNumber.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending
                ? (deletingNumber?.connectionType === "sip_trunk" ? "Disconnecting..." : "Releasing...")
                : (deletingNumber?.connectionType === "sip_trunk" ? "Disconnect" : "Release")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
