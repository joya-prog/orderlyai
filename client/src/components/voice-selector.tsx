import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Play, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  onSelectVoice: (voiceId: string, voiceName: string, provider?: string) => void;
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-100 text-blue-600",
    "bg-green-100 text-green-600",
    "bg-purple-100 text-purple-600",
    "bg-amber-100 text-amber-600",
    "bg-rose-100 text-rose-600",
    "bg-cyan-100 text-cyan-600",
    "bg-indigo-100 text-indigo-600",
    "bg-emerald-100 text-emerald-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export function VoiceSelector({ open, onOpenChange, provider: initialProvider, selectedVoiceId, onSelectVoice }: VoiceSelectorProps) {
  const { toast } = useToast();
  const [activeProvider, setActiveProvider] = useState<"elevenlabs" | "openai">(
    initialProvider === "openai" ? "openai" : "elevenlabs"
  );
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [accentFilter, setAccentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialProvider === "openai") {
      setActiveProvider("openai");
    } else {
      setActiveProvider("elevenlabs");
    }
  }, [initialProvider]);

  useEffect(() => {
    if (open) {
      fetchVoices();
    }
  }, [open, activeProvider]);

  const fetchVoices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/voices/${activeProvider}`);
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
      setVoices([]);
    } finally {
      setLoading(false);
    }
  };

  const getVoiceId = (voice: Voice) => voice.voice_id || voice.id || "";

  const filteredVoices = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    const genderLower = genderFilter.toLowerCase();
    const accentLower = accentFilter.toLowerCase();
    const typeLower = typeFilter.toLowerCase();
    
    return voices.filter((voice) => {
      const voiceId = getVoiceId(voice);
      const matchesSearch = voice.name.toLowerCase().includes(searchLower) ||
        voiceId.toLowerCase().includes(searchLower);
      const matchesGender = genderFilter === "all" || voice.labels?.gender?.toLowerCase() === genderLower;
      const matchesAccent = accentFilter === "all" || voice.labels?.accent?.toLowerCase() === accentLower;
      const matchesType = typeFilter === "all" || voice.labels?.use_case?.toLowerCase() === typeLower;
      return matchesSearch && matchesGender && matchesAccent && matchesType;
    });
  }, [voices, searchQuery, genderFilter, accentFilter, typeFilter]);

  const uniqueAccents = useMemo(() => 
    Array.from(new Set(voices.map(v => v.labels?.accent).filter(Boolean))), 
    [voices]
  );
  
  const uniqueTypes = useMemo(() => 
    Array.from(new Set(voices.map(v => v.labels?.use_case).filter(Boolean))), 
    [voices]
  );

  const recommendedVoices = useMemo(() => voices.slice(0, 4), [voices]);

  // Restaurant/hospitality voice preview phrases - varied and longer
  const previewPhrases = useMemo(() => [
    "Welcome to our restaurant! I'd be happy to help you with a reservation, take your order, or answer any questions about our menu.",
    "Good evening and thank you for calling! Whether you're looking to book a table or hear about tonight's specials, I'm here to assist you.",
    "Hi there! I can help you place an order for pickup or delivery, check on a reservation, or tell you about our hours and location.",
    "Thanks for reaching out! I'm your virtual host and I'd love to help you find the perfect dining experience with us today.",
    "Hello and welcome! I can assist with reservations, answer questions about dietary accommodations, or walk you through our seasonal menu.",
    "Good afternoon! Whether you need to modify a reservation, place a catering order, or learn about our private dining options, I'm at your service.",
    "Hi, thank you for calling! I'm here to make your dining experience seamless, from booking your table to answering any special requests.",
    "Welcome! I'd be delighted to help you explore our menu, check table availability, or assist with any special occasion planning.",
  ], []);

  // Get a consistent phrase for each voice based on its ID
  const getPreviewPhrase = (voiceId: string) => {
    let hash = 0;
    for (let i = 0; i < voiceId.length; i++) {
      hash = ((hash << 5) - hash) + voiceId.charCodeAt(i);
      hash = hash & hash;
    }
    return previewPhrases[Math.abs(hash) % previewPhrases.length];
  };

  const playVoice = async (voiceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    try {
      setLoadingVoiceId(voiceId);

      // Find the voice to get its preview_url if available
      const voice = voices.find(v => getVoiceId(v) === voiceId);
      
      const response = await fetch(`/api/voices/${activeProvider}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          voiceId,
          text: getPreviewPhrase(voiceId),
          previewUrl: voice?.preview_url || undefined,
        }),
      });

      if (!response.ok) {
        toast({
          title: "Preview unavailable",
          description: "Voice preview is currently unavailable. The voice will work when deployed.",
        });
        setLoadingVoiceId(null);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      setLoadingVoiceId(null);
      setPlayingVoiceId(voiceId);
      
      audio.onended = () => setPlayingVoiceId(null);
      await audio.play();
    } catch (error) {
      console.error("Voice preview failed:", error);
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
    }
  };

  const handleSelectVoice = (voiceId: string, voiceName: string) => {
    onSelectVoice(voiceId, voiceName, activeProvider);
  };

  const scrollRecommended = (direction: "left" | "right") => {
    if (recommendedScrollRef.current) {
      const scrollAmount = 280;
      recommendedScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 shadow-2xl border-0 ring-1 ring-black/5 dark:ring-white/10">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-xl font-semibold">Select Voice</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          {/* Provider Tabs */}
          <div className="px-6 border-b">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveProvider("elevenlabs")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeProvider === "elevenlabs"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid="tab-elevenlabs"
              >
                ElevenLabs
              </button>
              <button
                onClick={() => setActiveProvider("openai")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeProvider === "openai"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid="tab-openai"
              >
                OpenAI
              </button>
            </div>
          </div>

          {/* Filter Row */}
          <div className="px-6 py-4 flex items-center gap-3 border-b bg-gray-50/50 dark:bg-gray-900/50">
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-32" data-testid="filter-gender">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>

            <Select value={accentFilter} onValueChange={setAccentFilter}>
              <SelectTrigger className="w-36" data-testid="filter-accent">
                <SelectValue placeholder="Accent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accents</SelectItem>
                {uniqueAccents.map((accent) => (
                  <SelectItem key={accent} value={accent!.toLowerCase()}>
                    {accent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32" data-testid="filter-type">
                <SelectValue placeholder="Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type!.toLowerCase()}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
              data-testid="voice-search"
            />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Loading voices...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Recommended Voices */}
              {recommendedVoices.length > 0 && (
                <div className="px-6 py-4 border-b">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Recommended Voices</h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => scrollRecommended("left")}
                        data-testid="recommended-scroll-left"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => scrollRecommended("right")}
                        data-testid="recommended-scroll-right"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div 
                    ref={recommendedScrollRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {recommendedVoices.map((voice) => {
                      const voiceId = getVoiceId(voice);
                      return (
                        <div
                          key={voiceId}
                          onClick={() => handleSelectVoice(voiceId, voice.name)}
                          className={`flex-shrink-0 w-64 p-4 rounded-xl border bg-white dark:bg-gray-900 cursor-pointer transition-all hover:shadow-md ${
                            selectedVoiceId === voiceId ? "ring-2 ring-primary" : ""
                          }`}
                          data-testid={`recommended-voice-${voiceId}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className={getAvatarColor(voice.name)}>
                                {getInitials(voice.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{voice.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {voice.labels?.accent || "American"} · {voice.labels?.age || "Young"} · {voice.labels?.use_case || "preset"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                ID: {voiceId}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => playVoice(voiceId, e)}
                              disabled={loadingVoiceId === voiceId || playingVoiceId === voiceId}
                              data-testid={`play-recommended-${voiceId}`}
                            >
                              {loadingVoiceId === voiceId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Voice List Table */}
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Table Header */}
                <div className="px-6 py-3 grid grid-cols-[40px_1fr_1fr_1fr] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                  <div></div>
                  <div>Voice</div>
                  <div>Trait</div>
                  <div>Voice ID</div>
                </div>

                {/* Table Body */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="divide-y">
                    {filteredVoices.length === 0 ? (
                      <div className="px-6 py-12 text-center text-muted-foreground">
                        No voices found matching your filters
                      </div>
                    ) : (
                      filteredVoices.map((voice) => {
                        const voiceId = getVoiceId(voice);
                        return (
                          <div
                            key={voiceId}
                            onClick={() => handleSelectVoice(voiceId, voice.name)}
                            className={`px-6 py-3 grid grid-cols-[40px_1fr_1fr_1fr] gap-4 items-center cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
                              selectedVoiceId === voiceId ? "bg-primary/5" : ""
                            }`}
                            data-testid={`voice-row-${voiceId}`}
                          >
                            {/* Play Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => playVoice(voiceId, e)}
                              disabled={loadingVoiceId === voiceId || playingVoiceId === voiceId}
                              data-testid={`play-voice-${voiceId}`}
                            >
                              {loadingVoiceId === voiceId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>

                            {/* Voice Name with Avatar */}
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={getAvatarColor(voice.name)}>
                                  {getInitials(voice.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{voice.name}</span>
                            </div>

                            {/* Traits */}
                            <div className="flex flex-wrap gap-1.5">
                              {voice.labels?.accent && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  {voice.labels.accent}
                                </Badge>
                              )}
                              {voice.labels?.age && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  {voice.labels.age}
                                </Badge>
                              )}
                              {voice.labels?.use_case && (
                                <Badge variant="outline" className="text-xs font-normal">
                                  {voice.labels.use_case}
                                </Badge>
                              )}
                            </div>

                            {/* Voice ID */}
                            <div className="text-sm text-muted-foreground font-mono">
                              {voiceId}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
