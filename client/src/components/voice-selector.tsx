import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Volume2, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Voice {
  id?: string;
  voice_id?: string;
  name: string;
  preview_url?: string;
  description?: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
}

interface VoiceSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string, voiceName: string) => void;
}

export function VoiceSelector({ open, onOpenChange, provider, selectedVoiceId, onSelectVoice }: VoiceSelectorProps) {
  const { toast } = useToast();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accentFilter, setAccentFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const getVoiceId = (voice: Voice) => voice.voice_id || voice.id || "";

  useEffect(() => {
    if (open && provider) {
      fetchVoices();
    }
  }, [open, provider]);

  const fetchVoices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/voices/${provider}`);
      if (!response.ok) throw new Error("Failed to fetch voices");
      const data = await response.json();
      setVoices(data);
    } catch (error) {
      console.error("Error fetching voices:", error);
      toast({
        title: "Error",
        description: "Failed to load voices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const playVoice = async (voiceId: string) => {
    try {
      setPlayingVoiceId(voiceId);
      const response = await fetch(`/api/voices/${provider}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });

      if (!response.ok) throw new Error("Preview failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setPlayingVoiceId(null);
      await audio.play();
    } catch (error) {
      console.error("Voice preview failed:", error);
      toast({
        title: "Error",
        description: "Failed to play voice preview",
        variant: "destructive",
      });
      setPlayingVoiceId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Voice ID copied to clipboard",
    });
  };

  const filteredVoices = voices.filter((voice) => {
    const voiceId = getVoiceId(voice);
    const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voiceId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccent = accentFilter === "all" || voice.labels?.accent?.toLowerCase() === accentFilter.toLowerCase();
    const matchesGender = genderFilter === "all" || voice.labels?.gender?.toLowerCase() === genderFilter;
    return matchesSearch && matchesAccent && matchesGender;
  });

  const totalPages = Math.ceil(filteredVoices.length / itemsPerPage);
  const paginatedVoices = filteredVoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueAccents = Array.from(new Set(voices.map(v => v.labels?.accent).filter(Boolean)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Voice</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[240px_1fr] gap-6 flex-1 overflow-hidden">
          {/* Left Sidebar - Filters */}
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <p className="text-xs text-muted-foreground mb-2">
                Change provider in the main Voice tab first
              </p>
              <Select value={provider} disabled>
                <SelectTrigger data-testid="voice-selector-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Accent</label>
              <Select value={accentFilter} onValueChange={setAccentFilter}>
                <SelectTrigger data-testid="voice-selector-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueAccents.map((accent) => (
                    <SelectItem key={accent} value={accent!.toLowerCase()}>
                      {accent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Gender</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="all"
                    checked={genderFilter === "all"}
                    onChange={(e) => setGenderFilter(e.target.value as any)}
                    className="h-4 w-4"
                    data-testid="voice-selector-gender-all"
                  />
                  <span className="text-sm">All</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={genderFilter === "male"}
                    onChange={(e) => setGenderFilter(e.target.value as any)}
                    className="h-4 w-4"
                    data-testid="voice-selector-gender-male"
                  />
                  <span className="text-sm">Male</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={genderFilter === "female"}
                    onChange={(e) => setGenderFilter(e.target.value as any)}
                    className="h-4 w-4"
                    data-testid="voice-selector-gender-female"
                  />
                  <span className="text-sm">Female</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Content - Voice List */}
          <div className="flex flex-col overflow-hidden">
            <Tabs defaultValue="library" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="library">Library</TabsTrigger>
                  <TabsTrigger value="imported" disabled>Imported</TabsTrigger>
                  <TabsTrigger value="cloned" disabled>Cloned</TabsTrigger>
                </TabsList>

                <Input
                  placeholder="Search by name or ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                  data-testid="voice-selector-search"
                />
              </div>

              <TabsContent value="library" className="flex-1 overflow-auto space-y-3 mt-0">
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading voices...</div>
                ) : paginatedVoices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No voices found</div>
                ) : (
                  paginatedVoices.map((voice) => {
                    const voiceId = getVoiceId(voice);
                    return (
                      <div
                        key={voiceId}
                        className={`border rounded-lg p-4 hover-elevate cursor-pointer transition-all ${
                          selectedVoiceId === voiceId ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => onSelectVoice(voiceId, voice.name)}
                        data-testid={`voice-item-${voiceId}`}
                      >
                        <div className="flex items-start gap-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoice(voiceId);
                            }}
                            disabled={playingVoiceId === voiceId}
                            data-testid={`voice-play-${voiceId}`}
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>

                          <div className="flex-1 min-w-0">
                            <div className="font-medium mb-1">{voice.name}</div>
                            {voice.description && (
                              <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {voice.description}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {voice.labels?.accent && (
                                <Badge variant="secondary">{voice.labels.accent}</Badge>
                              )}
                              {voice.labels?.gender && (
                                <Badge variant="outline">{voice.labels.gender}</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">ID: {voiceId.substring(0, 8)}...</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(voiceId);
                              }}
                              data-testid={`voice-copy-${voiceId}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    data-testid="voice-page-first"
                  >
                    «
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    data-testid="voice-page-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    data-testid="voice-page-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    data-testid="voice-page-last"
                  >
                    »
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredVoices.length} results
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
