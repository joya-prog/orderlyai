import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  DollarSign, 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Pause,
  FileText,
  Smile,
  Meh,
  Frown,
  Calendar,
  Filter,
  X,
  Download,
  Volume2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { CallLog } from "@shared/schema";

export default function LogsPage() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: callLogs = [], isLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatDuration = (seconds: string | null | undefined) => {
    if (!seconds) return "0:00";
    const totalSeconds = parseInt(seconds, 10);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCost = (costCents: string | null | undefined) => {
    if (!costCents) return "$0.00";
    const cents = parseInt(costCents, 10);
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getSentimentIcon = (sentiment: string | null | undefined) => {
    switch (sentiment) {
      case "positive":
        return <Smile className="h-4 w-4 text-green-500" />;
      case "negative":
        return <Frown className="h-4 w-4 text-red-500" />;
      case "neutral":
      default:
        return <Meh className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getSentimentBadge = (sentiment: string | null | undefined) => {
    switch (sentiment) {
      case "positive":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Positive</Badge>;
      case "negative":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Negative</Badge>;
      case "neutral":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Neutral</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case "busy":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Busy</Badge>;
      case "no-answer":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">No Answer</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string | null | undefined) => {
    switch (outcome) {
      case "order_placed":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Order Placed</Badge>;
      case "reservation_made":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Reservation Made</Badge>;
      case "info_provided":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Info Provided</Badge>;
      case "transferred":
        return <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">Transferred</Badge>;
      case "callback_scheduled":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Callback Scheduled</Badge>;
      case "no_resolution":
        return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">No Resolution</Badge>;
      default:
        return null;
    }
  };

  const getEndReasonText = (endReason: string | null | undefined) => {
    switch (endReason) {
      case "customer_hangup":
        return "Customer hung up";
      case "agent_hangup":
        return "Agent ended call";
      case "transfer":
        return "Transferred";
      case "voicemail":
        return "Went to voicemail";
      case "timeout":
        return "Timed out";
      case "error":
        return "Error occurred";
      default:
        return endReason || "Unknown";
    }
  };

  const filteredLogs = callLogs.filter((log) => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (sentimentFilter !== "all" && log.sentiment !== sentimentFilter) return false;
    if (outcomeFilter !== "all" && log.callOutcome !== outcomeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesFrom = log.fromNumber?.toLowerCase().includes(query);
      const matchesTo = log.toNumber?.toLowerCase().includes(query);
      const matchesTranscript = log.transcript?.toLowerCase().includes(query);
      if (!matchesFrom && !matchesTo && !matchesTranscript) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setStatusFilter("all");
    setSentimentFilter("all");
    setOutcomeFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters = statusFilter !== "all" || sentimentFilter !== "all" || outcomeFilter !== "all" || searchQuery;

  const totalCalls = filteredLogs.length;
  const totalMinutes = filteredLogs.reduce((sum, log) => {
    const seconds = parseInt(log.durationSeconds || log.duration || "0", 10);
    return sum + seconds / 60;
  }, 0);
  const totalCost = filteredLogs.reduce((sum, log) => {
    const cents = parseInt(log.costCents || "0", 10);
    return sum + cents / 100;
  }, 0);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <h1 className="text-2xl md:text-3xl font-semibold font-serif mb-6">Call Logs</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold font-serif">Call Logs</h1>
          <p className="text-muted-foreground mt-1">View your call history, recordings, and transcripts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold" data-testid="text-total-calls">{totalCalls}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Minutes</p>
                <p className="text-2xl font-bold" data-testid="text-total-minutes">{totalMinutes.toFixed(1)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold" data-testid="text-total-cost">${totalCost.toFixed(2)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                {filteredLogs.length} {filteredLogs.length === 1 ? "call" : "calls"} found
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search by phone or transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-64"
                data-testid="input-search-logs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="no-answer">No Answer</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-sentiment-filter">
                  <Smile className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiment</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-outcome-filter">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="order_placed">Order Placed</SelectItem>
                  <SelectItem value="reservation_made">Reservation Made</SelectItem>
                  <SelectItem value="info_provided">Info Provided</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="callback_scheduled">Callback Scheduled</SelectItem>
                  <SelectItem value="no_resolution">No Resolution</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No call logs found</h3>
              <p className="text-muted-foreground">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results" 
                  : "Call logs will appear here once your agents start handling calls"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <Collapsible key={log.id} open={expandedRows.has(log.id)} onOpenChange={() => toggleRow(log.id)}>
                      <TableRow 
                        className="cursor-pointer hover-elevate" 
                        onClick={() => toggleRow(log.id)}
                        data-testid={`row-call-${log.id}`}
                      >
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-expand-${log.id}`}>
                              {expandedRows.has(log.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.direction === "inbound" ? (
                              <PhoneIncoming className="h-4 w-4 text-green-600" />
                            ) : (
                              <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                            )}
                            <span className="capitalize">{log.direction}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={`text-from-${log.id}`}>
                          {log.fromNumber || "Unknown"}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={`text-to-${log.id}`}>
                          {log.toNumber || "Unknown"}
                        </TableCell>
                        <TableCell data-testid={`text-duration-${log.id}`}>
                          {formatDuration(log.durationSeconds || log.duration)}
                        </TableCell>
                        <TableCell data-testid={`text-cost-${log.id}`}>
                          {formatCost(log.costCents)}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSentimentIcon(log.sentiment)}
                            <span className="text-sm capitalize">{log.sentiment || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getOutcomeBadge(log.callOutcome)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.createdAt ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span title={format(new Date(log.createdAt), "PPpp")}>
                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          ) : (
                            "Unknown"
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={10} className="p-0">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Call Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Call SID:</span>
                                      <span className="font-mono">{log.callSid || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">End Reason:</span>
                                      <span>{getEndReasonText(log.endReason)}</span>
                                    </div>
                                    {log.createdAt && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Date/Time:</span>
                                        <span>{format(new Date(log.createdAt), "PPpp")}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {log.recordingUrl && (
                                  <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <Volume2 className="h-4 w-4" />
                                      Recording
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <audio
                                        controls
                                        src={log.recordingUrl}
                                        className="w-full h-10"
                                        data-testid={`audio-recording-${log.id}`}
                                      />
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        asChild
                                        data-testid={`button-download-${log.id}`}
                                      >
                                        <a href={log.recordingUrl} download>
                                          <Download className="h-4 w-4" />
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {log.transcript && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Transcript
                                  </h4>
                                  <div 
                                    className="bg-background rounded-lg border p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto"
                                    data-testid={`text-transcript-${log.id}`}
                                  >
                                    {log.transcript}
                                  </div>
                                </div>
                              )}

                              {!log.transcript && !log.recordingUrl && (
                                <p className="text-muted-foreground text-sm text-center py-4">
                                  No recording or transcript available for this call
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
