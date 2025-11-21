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
import { Phone, Plus, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  areaCode: z.string().min(3, "Area code must be at least 3 digits"),
  country: z.string().default("US"),
});

const purchaseSchema = z.object({
  phoneNumber: z.string(),
  friendlyName: z.string().optional(),
});

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  capabilities: any;
}

export default function PhoneNumbersPage() {
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
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
      setIsPurchaseDialogOpen(false);
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

  const handleAssign = (phoneNumberId: string, agentId: string) => {
    const newAgentId = agentId === "unassigned" ? null : agentId;
    assignMutation.mutate({ id: phoneNumberId, agentId: newAgentId });
  };

  const handleOpenPurchaseDialog = () => {
    searchForm.reset();
    purchaseForm.reset();
    setAvailableNumbers([]);
    setIsSearching(false);
    setIsPurchaseDialogOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold font-serif mb-2">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage Twilio phone numbers and assign them to agents
          </p>
        </div>
        <Button 
          onClick={handleOpenPurchaseDialog}
          data-testid="button-buy-number"
        >
          <Plus className="mr-2 h-4 w-4" />
          Buy Number
        </Button>
      </div>

      {numbersLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading phone numbers...</p>
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
            <Phone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-numbers">No phone numbers</h3>
          <p className="text-muted-foreground mb-4">
            Get started by purchasing your first phone number
          </p>
          <Button onClick={handleOpenPurchaseDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Buy Number
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone Number</TableHead>
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

      {/* Purchase Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-purchase-phone">
          <DialogHeader>
            <DialogTitle>Buy Phone Number</DialogTitle>
            <DialogDescription>
              Search for available phone numbers by area code
            </DialogDescription>
          </DialogHeader>

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
                    onClick={() => setIsPurchaseDialogOpen(false)}
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
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted cursor-pointer"
                    onClick={() => {
                      purchaseForm.setValue("phoneNumber", num.phoneNumber);
                      purchaseForm.setValue("friendlyName", num.phoneNumber);
                    }}
                    data-testid={`available-number-${num.phoneNumber}`}
                  >
                    <div>
                      <p className="font-medium">{num.phoneNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        Voice: {num.capabilities?.voice ? "✓" : "✗"} | 
                        SMS: {num.capabilities?.sms ? "✓" : "✗"}
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
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingNumber} onOpenChange={() => setDeletingNumber(null)}>
        <DialogContent data-testid="dialog-delete-phone">
          <DialogHeader>
            <DialogTitle>Release Phone Number</DialogTitle>
            <DialogDescription>
              Are you sure you want to release {deletingNumber?.number}? This action cannot be undone and the number will be returned to Twilio's pool.
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
              {deleteMutation.isPending ? "Releasing..." : "Release Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
