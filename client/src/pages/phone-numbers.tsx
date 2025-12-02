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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Phone, Plus, Trash2, Search, Link2, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  areaCode: z.string().min(3, "Area code must be at least 3 digits"),
  country: z.string().default("US"),
});

const purchaseSchema = z.object({
  phoneNumber: z.string(),
  friendlyName: z.string().optional(),
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
  capabilities: any;
}

export default function PhoneNumbersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"purchase" | "sip">("purchase");
  const [deletingNumber, setDeletingNumber] = useState<PhoneNumber | null>(null);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const { data: phoneNumbers = [], isLoading: numbersLoading } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      areaCode: "",
      country: "US",
    },
  });

  const purchaseForm = useForm<z.infer<typeof purchaseSchema>>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      phoneNumber: "",
      friendlyName: "",
    },
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
      setIsSearching(false);
      if (data.length === 0) {
        toast({
          title: "No numbers found",
          description: "Try a different area code",
        });
      }
    },
    onError: (error: Error) => {
      setIsSearching(false);
      toast({
        variant: "destructive",
        title: "Search failed",
        description: error.message,
      });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (data: z.infer<typeof purchaseSchema>) => 
      apiRequest("POST", "/api/phone-numbers/purchase", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setIsDialogOpen(false);
      setAvailableNumbers([]);
      searchForm.reset();
      purchaseForm.reset();
      toast({
        title: "Number purchased",
        description: "Phone number has been added to your account",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Purchase failed",
        description: error.message,
      });
    },
  });

  const sipTrunkMutation = useMutation({
    mutationFn: (data: z.infer<typeof sipTrunkSchema>) => 
      apiRequest("POST", "/api/phone-numbers/sip-trunk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setIsDialogOpen(false);
      sipForm.reset();
      toast({
        title: "SIP trunk connected",
        description: "Your phone number has been connected via SIP trunk",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message,
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string | null }) => 
      apiRequest("PATCH", `/api/phone-numbers/${id}`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({
        title: "Number updated",
        description: "Phone number assignment has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/phone-numbers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setDeletingNumber(null);
      toast({
        title: "Number released",
        description: "Phone number has been released from your account",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Release failed",
        description: error.message,
      });
    },
  });

  const handleSearch = (values: z.infer<typeof searchSchema>) => {
    setIsSearching(true);
    searchMutation.mutate(values);
  };

  const handlePurchase = (values: z.infer<typeof purchaseSchema>) => {
    purchaseMutation.mutate(values);
  };

  const handleSipConnect = (values: z.infer<typeof sipTrunkSchema>) => {
    sipTrunkMutation.mutate(values);
  };

  const handleAssign = (phoneNumberId: string, agentId: string) => {
    const newAgentId = agentId === "unassigned" ? null : agentId;
    assignMutation.mutate({ id: phoneNumberId, agentId: newAgentId });
  };

  const handleOpenDialog = () => {
    searchForm.reset();
    purchaseForm.reset();
    sipForm.reset();
    setAvailableNumbers([]);
    setIsSearching(false);
    setActiveTab("purchase");
    setIsDialogOpen(true);
  };

  const sipAuthType = sipForm.watch("sipAuthType");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold font-serif mb-2">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage phone numbers and assign them to agents
          </p>
        </div>
        <Button 
          onClick={handleOpenDialog}
          data-testid="button-add-number"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Number
        </Button>
      </div>

      {numbersLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading phone numbers...</p>
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
            <Phone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-numbers">No phone numbers</h3>
          <p className="text-muted-foreground mb-4">
            Buy a new number from Twilio or connect your existing number via SIP
          </p>
          <Button onClick={handleOpenDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Number
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone Number</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Friendly Name</TableHead>
              <TableHead>Assigned Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {phoneNumbers.map((phoneNumber) => (
              <TableRow key={phoneNumber.id} data-testid={`row-phone-${phoneNumber.id}`}>
                <TableCell className="font-medium">{phoneNumber.number}</TableCell>
                <TableCell>
                  <Badge 
                    variant={phoneNumber.connectionType === 'sip_trunk' ? 'outline' : 'secondary'}
                    className="gap-1"
                    data-testid={`connection-type-${phoneNumber.id}`}
                  >
                    {phoneNumber.connectionType === 'sip_trunk' ? (
                      <>
                        <Link2 className="h-3 w-3" />
                        SIP Trunk
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-3 w-3" />
                        Purchased
                      </>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>{phoneNumber.friendlyName || "-"}</TableCell>
                <TableCell>
                  <Select
                    value={phoneNumber.agentId || "unassigned"}
                    onValueChange={(value) => handleAssign(phoneNumber.id, value)}
                    disabled={assignMutation.isPending}
                  >
                    <SelectTrigger 
                      className="w-[200px]"
                      data-testid={`select-agent-${phoneNumber.id}`}
                    >
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem 
                          key={agent.id} 
                          value={agent.id}
                          data-testid={`option-agent-${agent.id}`}
                        >
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
      )}

      {/* Add Number Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-add-phone">
          <DialogHeader>
            <DialogTitle>Add Phone Number</DialogTitle>
            <DialogDescription>
              Buy a new number from Twilio or connect your existing number via SIP trunk
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "purchase" | "sip")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="purchase" className="gap-2" data-testid="tab-purchase">
                <ShoppingCart className="h-4 w-4" />
                Buy New Number
              </TabsTrigger>
              <TabsTrigger value="sip" className="gap-2" data-testid="tab-sip">
                <Link2 className="h-4 w-4" />
                Connect via SIP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchase" className="mt-4">
              {availableNumbers.length === 0 ? (
                <Form {...searchForm}>
                  <form onSubmit={searchForm.handleSubmit(handleSearch)} className="space-y-4">
                    <FormField
                      control={searchForm.control}
                      name="areaCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area Code</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., 415, 212, 310" 
                              {...field}
                              data-testid="input-area-code"
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
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-country">
                                <SelectValue placeholder="Select country" />
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
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(false)}
                        data-testid="button-cancel-search"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isSearching || searchMutation.isPending}
                        data-testid="button-search-numbers"
                      >
                        <Search className="mr-2 h-4 w-4" />
                        {isSearching ? "Searching..." : "Search Numbers"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              ) : (
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">
                      Found {availableNumbers.length} available numbers
                    </p>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {availableNumbers.map((num) => (
                      <div
                        key={num.phoneNumber}
                        className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer"
                        onClick={() => {
                          purchaseForm.setValue("phoneNumber", num.phoneNumber);
                          purchaseForm.setValue("friendlyName", num.phoneNumber);
                        }}
                        data-testid={`available-number-${num.phoneNumber}`}
                      >
                        <div>
                          <p className="font-medium">{num.phoneNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            Voice: {num.capabilities?.voice ? "Yes" : "No"} | 
                            SMS: {num.capabilities?.sms ? "Yes" : "No"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePurchase({
                              phoneNumber: num.phoneNumber,
                              friendlyName: num.phoneNumber,
                            });
                          }}
                          disabled={purchaseMutation.isPending}
                          data-testid={`button-purchase-${num.phoneNumber}`}
                        >
                          {purchaseMutation.isPending ? "Purchasing..." : "Purchase"}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setAvailableNumbers([])}
                      data-testid="button-back-to-search"
                    >
                      Back to Search
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sip" className="mt-4">
              <Form {...sipForm}>
                <form onSubmit={sipForm.handleSubmit(handleSipConnect)} className="space-y-4">
                  <FormField
                    control={sipForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+1 (555) 123-4567" 
                            {...field}
                            data-testid="input-sip-phone"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the phone number you want to connect via SIP
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sipForm.control}
                    name="friendlyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Friendly Name (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Main Restaurant Line" 
                            {...field}
                            data-testid="input-sip-friendly-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={sipForm.control}
                    name="sipDomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIP Domain (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="myrestaurant.sip.twilio.com" 
                            {...field}
                            data-testid="input-sip-domain"
                          />
                        </FormControl>
                        <FormDescription>
                          Leave empty to auto-generate a Twilio SIP domain
                        </FormDescription>
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
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-sip-auth">
                              <SelectValue placeholder="Select authentication method" />
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
                    <>
                      <FormField
                        control={sipForm.control}
                        name="sipUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIP Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="sip_user" 
                                {...field}
                                data-testid="input-sip-username"
                              />
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
                              <Input 
                                type="password"
                                placeholder="Enter password" 
                                {...field}
                                data-testid="input-sip-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {sipAuthType === "ip_acl" && (
                    <FormField
                      control={sipForm.control}
                      name="ipAddresses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allowed IP Addresses</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="192.168.1.1, 10.0.0.1" 
                              {...field}
                              data-testid="input-ip-addresses"
                            />
                          </FormControl>
                          <FormDescription>
                            Comma-separated list of IP addresses to whitelist
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel-sip"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={sipTrunkMutation.isPending}
                      data-testid="button-connect-sip"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {sipTrunkMutation.isPending ? "Connecting..." : "Connect SIP Trunk"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingNumber} onOpenChange={() => setDeletingNumber(null)}>
        <DialogContent data-testid="dialog-delete-phone">
          <DialogHeader>
            <DialogTitle>
              {deletingNumber?.connectionType === 'sip_trunk' 
                ? 'Disconnect SIP Trunk' 
                : 'Release Phone Number'}
            </DialogTitle>
            <DialogDescription>
              {deletingNumber?.connectionType === 'sip_trunk'
                ? `Are you sure you want to disconnect ${deletingNumber?.number} from SIP trunk? The trunk configuration will be removed.`
                : `Are you sure you want to release ${deletingNumber?.number}? This action cannot be undone and the number will be returned to Twilio's pool.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingNumber(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingNumber && deleteMutation.mutate(deletingNumber.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending 
                ? (deletingNumber?.connectionType === 'sip_trunk' ? "Disconnecting..." : "Releasing...") 
                : (deletingNumber?.connectionType === 'sip_trunk' ? "Disconnect" : "Release Number")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
