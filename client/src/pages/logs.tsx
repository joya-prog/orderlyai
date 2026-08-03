import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Volume2,
  User,
  ShoppingBag,
  Square,
  Sparkles,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { CallLog } from "@shared/schema";

function AudioPlayer({ src, logId }: { src: string; logId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-md p-2" data-testid={`audio-player-${logId}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        data-testid={`button-play-${logId}`}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
        <div
          className="flex-1 h-2 bg-muted rounded-full cursor-pointer relative"
          onClick={handleSeek}
          data-testid={`seekbar-${logId}`}
        >
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-10 tabular-nums">{formatTime(duration)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        asChild
        data-testid={`button-download-${logId}`}
      >
        <a href={src} download>
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

export default function LogsPage() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);

  const { data: callLogs = [], isLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (logId: string) => {
      setAnalyzingLogId(logId);
      return apiRequest("POST", `/api/call-logs/${logId}/analyze`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      setAnalyzingLogId(null);
    },
    onError: () => {
      setAnalyzingLogId(null);
    },
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
        return <Meh className="h-4 w-4 text-yellow-500" />;
      default:
        return <Meh className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentBadge = (sentiment: string | null | undefined) => {
    switch (sentiment) {
      case "positive":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Positive</Badge>;
      case "negative":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">Negative</Badge>;
      case "neutral":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800">Neutral</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Completed</Badge>;
      case "busy":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800">Busy</Badge>;
      case "no-answer":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">No Answer</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string | null | undefined) => {
    switch (outcome) {
      case "order_placed":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Order Placed</Badge>;
      case "reservation_made":
        return <Badge variant="outline" className="bg-chart-3/15 text-foreground border-chart-3/40 dark:bg-chart-3/20">Reservation</Badge>;
      case "info_provided":
        return <Badge variant="outline" className="bg-chart-4/15 text-foreground border-chart-4/40 dark:bg-chart-4/20">Info Provided</Badge>;
      case "transferred":
        return <Badge variant="outline" className="bg-chart-5/15 text-foreground border-chart-5/40 dark:bg-chart-5/20">Transferred</Badge>;
      case "callback_scheduled":
        return <Badge variant="outline" className="bg-chart-2/15 text-foreground border-chart-2/40 dark:bg-chart-2/20">Callback</Badge>;
      case "no_resolution":
        return <Badge variant="outline">No Resolution</Badge>;
      default:
        return null;
    }
  };

  const getEndReasonText = (endReason: string | null | undefined) => {
    switch (endReason) {
      case "customer_hangup": return "Customer hung up";
      case "agent_hangup": return "Agent ended call";
      case "transfer": return "Transferred";
      case "voicemail": return "Went to voicemail";
      case "timeout": return "Timed out";
      case "error": return "Error occurred";
      default: return endReason || "Unknown";
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
      const matchesCaller = log.callerName?.toLowerCase().includes(query);
      if (!matchesFrom && !matchesTo && !matchesTranscript && !matchesCaller) return false;
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
            <div className="flex items-center justify-between gap-2">
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
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Total Minutes</p>
                <p className="text-2xl font-bold" data-testid="text-total-minutes">{totalMinutes.toFixed(1)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold" data-testid="text-total-cost">${totalCost.toFixed(2)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
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
                placeholder="Search by name, phone, or transcript..."
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
                    <TableHead>Caller</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Playback</TableHead>
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
                            <Button variant="ghost" size="icon" data-testid={`button-expand-${log.id}`}>
                              {expandedRows.has(log.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate" data-testid={`text-caller-name-${log.id}`}>
                                {log.callerName || "Unknown Caller"}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate" data-testid={`text-from-${log.id}`}>
                                {log.fromNumber || "No number"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {log.direction === "inbound" ? (
                              <PhoneIncoming className="h-4 w-4 text-green-600" />
                            ) : (
                              <PhoneOutgoing className="h-4 w-4 text-primary" />
                            )}
                            <span className="text-sm capitalize">{log.direction}</span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-duration-${log.id}`}>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{formatDuration(log.durationSeconds || log.duration)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5" data-testid={`text-sentiment-${log.id}`}>
                            {getSentimentIcon(log.sentiment)}
                            <span className="text-sm capitalize">{log.sentiment || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-order-${log.id}`}>
                          {log.callOutcome === "order_placed" ? (
                            <div className="flex items-center gap-1.5">
                              <ShoppingBag className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Yes</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          {log.recordingUrl ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Volume2 className="h-4 w-4 text-primary" />
                              <span className="text-xs text-primary font-medium">Available</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>
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
                          <TableCell colSpan={9} className="p-0">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Caller Info
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">Name:</span>
                                      <span className="font-medium" data-testid={`text-detail-caller-${log.id}`}>{log.callerName || "Not identified"}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">From:</span>
                                      <span className="font-mono">{log.fromNumber || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">To:</span>
                                      <span className="font-mono">{log.toNumber || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">Sentiment:</span>
                                      {getSentimentBadge(log.sentiment)}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    Call Details
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">Duration:</span>
                                      <span>{formatDuration(log.durationSeconds || log.duration)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">Cost:</span>
                                      <span>{formatCost(log.costCents)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">End Reason:</span>
                                      <span>{getEndReasonText(log.endReason)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">Outcome:</span>
                                      {getOutcomeBadge(log.callOutcome) || <span>N/A</span>}
                                    </div>
                                    {log.createdAt && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Date/Time:</span>
                                        <span>{format(new Date(log.createdAt), "PPpp")}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <ShoppingBag className="h-4 w-4" />
                                    Order Summary
                                  </h4>
                                  {log.orderSummary ? (
                                    <div className="bg-background rounded-md border p-3 text-sm" data-testid={`text-order-summary-${log.id}`}>
                                      {log.orderSummary}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No order was placed during this call</p>
                                  )}
                                </div>
                              </div>

                              {log.recordingUrl && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Volume2 className="h-4 w-4" />
                                    Call Recording
                                  </h4>
                                  <AudioPlayer src={log.recordingUrl} logId={log.id} />
                                </div>
                              )}

                              {log.transcript && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      Transcript
                                    </h4>
                                    {!log.callerName && !log.sentiment && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => analyzeMutation.mutate(log.id)}
                                        disabled={analyzingLogId === log.id}
                                        data-testid={`button-analyze-${log.id}`}
                                      >
                                        {analyzingLogId === log.id ? (
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        ) : (
                                          <Sparkles className="h-3 w-3 mr-1" />
                                        )}
                                        Analyze with AI
                                      </Button>
                                    )}
                                  </div>
                                  <div 
                                    className="bg-background rounded-md border p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto"
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
