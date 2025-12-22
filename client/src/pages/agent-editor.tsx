import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, InsertAgent } from "@shared/schema";
import type { Node, Edge } from '@xyflow/react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Settings, Workflow, TestTube, Send, MessageSquare, Mic, MicOff, Phone, Volume2, X, Languages, Sparkles, Zap, Clock, Timer } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertAgentSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";
import { FlowBuilder } from "@/components/flow-builder";
import { VoiceSelector } from "@/components/voice-selector";

export default function AgentEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isNew = id === "new";
  const [activeTab, setActiveTab] = useState("settings");
  const [settingsTab, setSettingsTab] = useState("general");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [testInput, setTestInput] = useState("");
  const [testMode, setTestMode] = useState<"text" | "voice" | "call">("text");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [customVocabInput, setCustomVocabInput] = useState("");
  const [filterWordInput, setFilterWordInput] = useState("");
  const [callState, setCallState] = useState<"idle" | "connecting" | "greeting" | "listening" | "processing" | "speaking">("idle");
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [testCallWs, setTestCallWs] = useState<WebSocket | null>(null);
  const [testCallAudio, setTestCallAudio] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioWorkletNode, setAudioWorkletNode] = useState<AudioWorkletNode | null>(null);
  const [useMicFallback, setUseMicFallback] = useState(false); // True when mic not available, use text input

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: isAuthenticated && !isNew,
  });

  const { data: flowNodesData = [] } = useQuery<any[]>({
    queryKey: ["/api/agents", id, "flow-nodes"],
    enabled: isAuthenticated && !isNew,
  });

  const { data: flowConnectionsData = [] } = useQuery<any[]>({
    queryKey: ["/api/agents", id, "flow-connections"],
    enabled: isAuthenticated && !isNew,
  });

  const initialNodes = useMemo(() => {
    return flowNodesData.map((node) => ({
      id: node.id,
      type: 'custom',
      position: node.position || { x: 0, y: 0 },
      data: {
        type: node.type,
        label: node.label,
        content: node.content,
        config: node.config,
        agentId: node.agentId,
      },
    }));
  }, [flowNodesData]);

  const initialEdges = useMemo(() => {
    return flowConnectionsData.map((conn) => ({
      id: conn.id,
      source: conn.sourceNodeId,
      target: conn.targetNodeId,
      label: conn.label,
    }));
  }, [flowConnectionsData]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const form = useForm<any>({
    defaultValues: {
      userId: user?.id || "",
      name: "",
      description: "",
      industry: "casual_dining",
      status: "draft",
      greetingMessage: "Hello! Thanks for calling. How can I help you today?",
      personality: "Friendly, professional, and helpful",
      systemPrompt: "You are a helpful AI assistant for a restaurant. Help customers with reservations, menu questions, and general inquiries.",
      voiceEngine: "1.0",
      aiModel: "gpt-4o-mini",
      timezone: "US/Pacific",
      customVocabulary: [],
      filterWords: [],
      useFillerWords: false,
      // Retell-compatible voice settings
      voiceProvider: "elevenlabs",
      voiceId: "11labs-Adrian",
      voiceModel: "eleven_turbo_v2",
      voiceName: "Adrian",
      language: "en-US",
      voiceSpeed: "1.0",
      voiceTemperature: "1.0",
      voiceVolume: "1.0",
      fallbackVoiceId: "",
      // Speech & Transcription
      interruptionSensitivity: "1.0",
      responsiveness: "1.0",
      boostedKeywords: [],
      pronunciationDictionary: [],
      textNormalization: true,
      // Backchannel settings
      enableBackchannel: true,
      backchannelFrequency: "0.9",
      backchannelWords: ["yeah", "uh-huh", "I see"],
      // Ambient sound
      ambientSound: "",
      ambientSoundVolume: "1.0",
      // Reminder settings
      reminderTriggerMs: "10000",
      reminderMaxCount: "2",
      reminderMessage: "I'm still here. Do you have any questions?",
      // Call management
      beginMessageDelayMs: "1000",
      endCallPhrases: ["goodbye", "bye", "have a nice day"],
      maxCallDurationMs: "3600000",
      inactivityTimeoutMs: "30000",
      // Voicemail
      voicemailDetection: false,
      voicemailMessage: "",
      // Warm transfer
      warmTransferEnabled: false,
      warmTransferNumber: "",
      warmTransferMessage: "",
      // Legacy fields
      voicePrompting: "",
      patienceLevel: "medium",
      speechRecognition: "faster",
      optimizeLatency: "0",
      stability: "50",
      styleExaggeration: "0",
      similarity: "75",
      maxIdleDuration: "7",
      speakerBoost: false,
      idleReminders: true,
      idleReminderMessage: "I'm still here. Do you have any questions?",
      idleReminderInterval: "4",
      pauseBeforeSpeaking: "0",
      ringDuration: "0",
      limitCallDuration: true,
      maxCallDuration: "20",
      enableRecordings: false,
      enableTranscripts: true,
      limitDataRetention: false,
    },
  });

  useEffect(() => {
    if (agent && !isNew) {
      form.reset({
        userId: agent.userId,
        name: agent.name,
        description: agent.description || "",
        industry: agent.industry,
        status: agent.status,
        greetingMessage: agent.greetingMessage,
        personality: agent.personality,
        systemPrompt: agent.systemPrompt,
        voiceEngine: agent.voiceEngine || "1.0",
        aiModel: agent.aiModel || "gpt-4o-mini",
        timezone: agent.timezone || "US/Pacific",
        customVocabulary: agent.customVocabulary || [],
        filterWords: agent.filterWords || [],
        useFillerWords: agent.useFillerWords || false,
        // Retell-compatible voice settings
        voiceProvider: agent.voiceProvider || "elevenlabs",
        voiceId: agent.voiceId || "11labs-Adrian",
        voiceModel: (agent as any).voiceModel || "eleven_turbo_v2",
        voiceName: agent.voiceName || "Adrian",
        language: agent.language || "en-US",
        voiceSpeed: agent.voiceSpeed || "1.0",
        voiceTemperature: (agent as any).voiceTemperature || "1.0",
        voiceVolume: agent.voiceVolume || "1.0",
        fallbackVoiceId: (agent as any).fallbackVoiceId || "",
        // Speech & Transcription
        interruptionSensitivity: agent.interruptionSensitivity || "1.0",
        responsiveness: (agent as any).responsiveness || "1.0",
        boostedKeywords: (agent as any).boostedKeywords || [],
        pronunciationDictionary: (agent as any).pronunciationDictionary || [],
        textNormalization: (agent as any).textNormalization !== undefined ? (agent as any).textNormalization : true,
        // Backchannel settings
        enableBackchannel: (agent as any).enableBackchannel !== undefined ? (agent as any).enableBackchannel : true,
        backchannelFrequency: (agent as any).backchannelFrequency || "0.9",
        backchannelWords: (agent as any).backchannelWords || ["yeah", "uh-huh", "I see"],
        // Ambient sound
        ambientSound: (agent as any).ambientSound || "",
        ambientSoundVolume: (agent as any).ambientSoundVolume || "1.0",
        // Reminder settings
        reminderTriggerMs: (agent as any).reminderTriggerMs || "10000",
        reminderMaxCount: (agent as any).reminderMaxCount || "2",
        reminderMessage: (agent as any).reminderMessage || "I'm still here. Do you have any questions?",
        // Call management
        beginMessageDelayMs: (agent as any).beginMessageDelayMs || "1000",
        endCallPhrases: (agent as any).endCallPhrases || ["goodbye", "bye", "have a nice day"],
        maxCallDurationMs: (agent as any).maxCallDurationMs || "3600000",
        inactivityTimeoutMs: (agent as any).inactivityTimeoutMs || "30000",
        // Voicemail
        voicemailDetection: (agent as any).voicemailDetection || false,
        voicemailMessage: (agent as any).voicemailMessage || "",
        // Warm transfer
        warmTransferEnabled: (agent as any).warmTransferEnabled || false,
        warmTransferNumber: (agent as any).warmTransferNumber || "",
        warmTransferMessage: (agent as any).warmTransferMessage || "",
        // Legacy fields
        voicePrompting: agent.voicePrompting || "",
        patienceLevel: agent.patienceLevel || "medium",
        speechRecognition: agent.speechRecognition || "faster",
        optimizeLatency: agent.optimizeLatency || "0",
        stability: agent.stability || "50",
        styleExaggeration: agent.styleExaggeration || "0",
        similarity: agent.similarity || "75",
        maxIdleDuration: agent.maxIdleDuration || "7",
        speakerBoost: agent.speakerBoost || false,
        idleReminders: agent.idleReminders !== undefined ? agent.idleReminders : true,
        idleReminderMessage: agent.idleReminderMessage || "I'm still here. Do you have any questions?",
        idleReminderInterval: agent.idleReminderInterval || "4",
        pauseBeforeSpeaking: agent.pauseBeforeSpeaking || "0",
        ringDuration: agent.ringDuration || "0",
        limitCallDuration: agent.limitCallDuration !== undefined ? agent.limitCallDuration : true,
        maxCallDuration: agent.maxCallDuration || "20",
        enableRecordings: agent.enableRecordings || false,
        enableTranscripts: agent.enableTranscripts !== undefined ? agent.enableTranscripts : true,
        limitDataRetention: agent.limitDataRetention || false,
      });
    }
  }, [agent, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        return await apiRequest("POST", "/api/agents", { ...data, userId: user?.id });
      } else {
        return await apiRequest("PATCH", `/api/agents/${id}`, data);
      }
    },
    onSuccess: (data: Agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: isNew ? "Agent created successfully" : "Agent updated successfully",
      });
      if (isNew) {
        navigate(`/agents/${data.id}`);
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save agent",
        variant: "destructive",
      });
    },
  });

  const saveFlowMutation = useMutation({
    mutationFn: async ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const dbNodes = nodes.map((node) => ({
        id: node.id,
        agentId: id,
        type: node.data.type,
        label: node.data.label,
        content: node.data.content || '',
        position: node.position,
        config: node.data.config || {},
      }));

      const dbEdges = edges.map((edge) => ({
        agentId: id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        label: edge.label || '',
      }));

      await apiRequest("POST", `/api/agents/${id}/flow-nodes/bulk`, { nodes: dbNodes });
      await apiRequest("POST", `/api/agents/${id}/flow-connections/bulk`, { connections: dbEdges });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "flow-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "flow-connections"] });
      toast({
        title: "Success",
        description: "Workflow saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    },
  });

  const handleSaveFlow = useCallback((nodes: Node[], edges: Edge[]) => {
    saveFlowMutation.mutate({ nodes, edges });
  }, [saveFlowMutation]);

  const testMutation = useMutation({
    mutationFn: async ({ message, history }: { message: string; history: Array<{ role: string; content: string }> }) => {
      const response = await apiRequest("POST", `/api/agents/${id}/test`, {
        message,
        history,
      });
      return response;
    },
    onSuccess: (data: { response: string }) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      setTestInput("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to get response from agent",
        variant: "destructive",
      });
    },
  });

  const handleSendTest = () => {
    if (!testInput.trim()) return;
    // Capture updated messages before sending to API
    const updatedMessages = [...messages, { role: "user" as const, content: testInput }];
    setMessages(updatedMessages);
    testMutation.mutate({ message: testInput, history: updatedMessages });
  };

  // Start test chat with agent greeting first
  const handleStartTestChat = async () => {
    try {
      // Fetch the agent's greeting and add it as the first message
      const response = await apiRequest("POST", `/api/agents/${id}/start-chat`);
      const greeting = response.greeting || "Hello! Thank you for calling. How can I help you today?";
      setMessages([{ role: "assistant", content: greeting }]);
    } catch (error) {
      console.error("Error starting test chat:", error);
      // Fallback: just show default greeting
      setMessages([{ role: "assistant", content: "Hello! Thank you for calling. How can I help you today?" }]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        await processVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please allow microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const processVoiceMessage = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      // Transcribe audio
      const formData = new FormData();
      formData.append("audio", audioBlob);

      const transcribeResponse = await fetch(`/api/agents/${id}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error("Failed to transcribe audio");
      }

      const { text } = await transcribeResponse.json();
      
      // Show transcribed text to user
      toast({
        title: "You said:",
        description: text,
      });
      
      // Add user message to conversation and capture updated messages
      const updatedMessages = [...messages, { role: "user" as const, content: text }];
      setMessages(updatedMessages);

      // Get agent response using the updated message history
      const testResponse = await apiRequest("POST", `/api/agents/${id}/test`, {
        message: text,
        history: updatedMessages,
      });

      const agentResponse = testResponse.response;
      setMessages((prev) => [...prev, { role: "assistant", content: agentResponse }]);

      // Synthesize and play agent response
      const synthesizeResponse = await fetch(`/api/agents/${id}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: agentResponse }),
      });

      if (!synthesizeResponse.ok) {
        throw new Error("Failed to synthesize speech");
      }

      const audioBuffer = await synthesizeResponse.arrayBuffer();
      const audio = new Audio(URL.createObjectURL(new Blob([audioBuffer], { type: "audio/mpeg" })));
      audio.play();

      // Reset recorder state for next recording
      setMediaRecorder(null);

    } catch (error: any) {
      console.error("Error processing voice message:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to process voice message",
        variant: "destructive",
      });
      // Reset recorder state even on error
      setMediaRecorder(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startTestCall = async () => {
    if (!id || !user?.id) {
      toast({
        title: "Error",
        description: "Missing agent or user information",
        variant: "destructive",
      });
      return;
    }
    
    setCallState("connecting");
    setMessages([]);
    setIsMicMuted(false);
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      setMicStream(stream);
      
      // Create AudioContext at 16kHz for Whisper
      const ctx = new AudioContext({ sampleRate: 16000 });
      setAudioContext(ctx);
      
      // Load AudioWorklet processor
      await ctx.audioWorklet.addModule('/audio-processor.js');
      
      const source = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, 'audio-recorder-processor');
      setAudioWorkletNode(workletNode);
      
      source.connect(workletNode);
      // Don't connect to destination - we don't want local playback
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/test-call?agentId=${id}&userId=${user.id}`;
      console.log("[TestCall] Connecting to:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      // Buffer audio chunks until WebSocket is ready
      let audioBuffer: Int16Array[] = [];
      let wsReady = false;
      
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          const pcmData = new Int16Array(event.data.audio);
          if (wsReady && ws.readyState === WebSocket.OPEN) {
            // Send audio chunk as base64
            const bytes = new Uint8Array(pcmData.buffer);
            const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
            ws.send(JSON.stringify({ type: 'audio_chunk', audio: base64 }));
          } else {
            audioBuffer.push(pcmData);
          }
        }
      };
      
      ws.onopen = () => {
        console.log("[TestCall] Connected to test call WebSocket");
        wsReady = true;
        // Send any buffered audio
        audioBuffer.forEach(chunk => {
          const bytes = new Uint8Array(chunk.buffer);
          const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
          ws.send(JSON.stringify({ type: 'audio_chunk', audio: base64 }));
        });
        audioBuffer = [];
      };
      
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "connected":
              console.log("[TestCall] Session started:", message.callSid);
              setCallState("greeting");
              break;
              
            case "state":
              setCallState(message.state);
              break;
              
            case "audio":
              // Play the audio response
              const audioData = Uint8Array.from(atob(message.audio), c => c.charCodeAt(0));
              const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              setTestCallAudio(audio);
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
              };
              await audio.play();
              
              // Add the message to conversation
              if (message.text) {
                setMessages(prev => [...prev, { role: "assistant", content: message.text }]);
              }
              break;
              
            case "transcript":
              setMessages(prev => [...prev, { role: message.role, content: message.text }]);
              break;
              
            case "error":
              console.error("[TestCall] Error:", message.message);
              toast({
                title: "Call Error",
                description: message.message,
                variant: "destructive",
              });
              endTestCall();
              break;
          }
        } catch (error) {
          console.error("[TestCall] Error parsing message:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("[TestCall] WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to test call",
          variant: "destructive",
        });
        cleanupAudio();
        setCallState("idle");
      };
      
      ws.onclose = () => {
        console.log("[TestCall] WebSocket closed");
        cleanupAudio();
        setCallState("idle");
        setTestCallWs(null);
      };
      
      setTestCallWs(ws);
      
    } catch (error: any) {
      console.error("[TestCall] Error starting test call:", error);
      
      // If microphone failed, fall back to text-based call
      if (error.name === 'NotAllowedError' || error.name === 'NotFoundError' || error.name === 'NotReadableError') {
        console.log("[TestCall] Microphone not available, falling back to text mode");
        setUseMicFallback(true);
        await startTextOnlyCall();
      } else {
        toast({
          title: "Error",
          description: "Failed to start test call",
          variant: "destructive",
        });
        cleanupAudio();
        setCallState("idle");
      }
    }
  };
  
  // Start a text-only call when microphone is not available
  const startTextOnlyCall = async () => {
    if (!id || !user?.id) return;
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/test-call?agentId=${id}&userId=${user.id}`;
      console.log("[TestCall] Starting text-only call:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("[TestCall] Text-only call connected");
      };
      
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "connected":
              console.log("[TestCall] Session started:", message.callSid);
              setCallState("greeting");
              break;
              
            case "state":
              setCallState(message.state);
              break;
              
            case "audio":
              const audioData = Uint8Array.from(atob(message.audio), c => c.charCodeAt(0));
              const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              setTestCallAudio(audio);
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
              };
              await audio.play();
              
              if (message.text) {
                setMessages(prev => [...prev, { role: "assistant", content: message.text }]);
              }
              break;
              
            case "transcript":
              setMessages(prev => [...prev, { role: message.role, content: message.text }]);
              break;
              
            case "error":
              console.error("[TestCall] Error:", message.message);
              toast({
                title: "Call Error",
                description: message.message,
                variant: "destructive",
              });
              endTestCall();
              break;
          }
        } catch (error) {
          console.error("[TestCall] Error parsing message:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("[TestCall] WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to test call",
          variant: "destructive",
        });
        setCallState("idle");
      };
      
      ws.onclose = () => {
        console.log("[TestCall] WebSocket closed");
        setCallState("idle");
        setTestCallWs(null);
        setUseMicFallback(false);
      };
      
      setTestCallWs(ws);
      
    } catch (error) {
      console.error("[TestCall] Error starting text-only call:", error);
      toast({
        title: "Error",
        description: "Failed to start test call",
        variant: "destructive",
      });
      setCallState("idle");
      setUseMicFallback(false);
    }
  };
  
  const cleanupAudio = () => {
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    if (audioWorkletNode) {
      audioWorkletNode.disconnect();
      setAudioWorkletNode(null);
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
  };
  
  const endTestCall = () => {
    cleanupAudio();
    if (testCallWs) {
      testCallWs.send(JSON.stringify({ type: "end" }));
      testCallWs.close();
      setTestCallWs(null);
    }
    if (testCallAudio) {
      testCallAudio.pause();
      setTestCallAudio(null);
    }
    setCallState("idle");
    setIsMicMuted(false);
    setUseMicFallback(false);
  };
  
  const toggleMicMute = () => {
    if (micStream) {
      micStream.getAudioTracks().forEach(track => {
        track.enabled = isMicMuted;
      });
      setIsMicMuted(!isMicMuted);
    }
  };
  
  const sendTestCallText = (text: string) => {
    if (!testCallWs || !text.trim()) return;
    testCallWs.send(JSON.stringify({ type: "text", text: text.trim() }));
    setTestInput("");
  };

  if (!isNew && (authLoading || isLoading)) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/agents")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold font-serif">
              {isNew ? "Create Agent" : agent?.name || "Edit Agent"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeTab === "settings" 
                ? "Configure your AI voice agent settings" 
                : activeTab === "workflow"
                ? "Design conversation flows for your agent"
                : "Test conversations with your agent"}
            </p>
          </div>
        </div>
        {activeTab === "settings" && (
          <Button
            onClick={form.handleSubmit((data) => saveMutation.mutate(data))}
            disabled={saveMutation.isPending}
            data-testid="button-save-agent"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Agent"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="workflow" 
            className="gap-2" 
            disabled={isNew}
            data-testid="tab-workflow"
          >
            <Workflow className="h-4 w-4" />
            Workflow
          </TabsTrigger>
          <TabsTrigger 
            value="test" 
            className="gap-2" 
            disabled={isNew}
            data-testid="tab-test"
          >
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configure</CardTitle>
              <CardDescription>
                Customize your agent's voice, behavior, and call settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={settingsTab} onValueChange={setSettingsTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general" className="gap-2" data-testid="tab-general">
                    <Sparkles className="h-4 w-4" />
                    General
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="gap-2" data-testid="tab-voice">
                    <Volume2 className="h-4 w-4" />
                    Voice
                  </TabsTrigger>
                  <TabsTrigger value="call-config" className="gap-2" data-testid="tab-call-config">
                    <Phone className="h-4 w-4" />
                    Call Configuration
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                  <Form {...form}>
                    <form className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agent Name</FormLabel>
                            <FormDescription>What name will your agent go by.</FormDescription>
                            <FormControl>
                              <Input
                                placeholder="e.g., Restaurant Concierge"
                                {...field}
                                data-testid="input-agent-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormDescription>A brief description of this agent's purpose</FormDescription>
                            <FormControl>
                              <Input
                                placeholder="e.g., Handles reservations and menu inquiries"
                                {...field}
                                value={field.value || ""}
                                data-testid="input-agent-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="aiModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AI Model</FormLabel>
                            <FormDescription>Opt for speed or depth to suit your agent's role</FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-ai-model">
                                  <SelectValue placeholder="Select AI model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="gpt-4o">
                                  <div className="flex items-center gap-2">
                                    <span>GPT-4o</span>
                                    <Badge variant="secondary" className="text-xs">OpenAI</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="gpt-4">
                                  <div className="flex items-center gap-2">
                                    <span>GPT-4</span>
                                    <Badge variant="secondary" className="text-xs">OpenAI</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="gpt-3.5-turbo">
                                  <div className="flex items-center gap-2">
                                    <span>GPT-3.5 Turbo</span>
                                    <Badge variant="secondary" className="text-xs">OpenAI</Badge>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <FormDescription>The region in which your agent will be</FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-timezone">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="US/Pacific">US/Pacific</SelectItem>
                                <SelectItem value="US/Mountain">US/Mountain</SelectItem>
                                <SelectItem value="US/Central">US/Central</SelectItem>
                                <SelectItem value="US/Eastern">US/Eastern</SelectItem>
                                <SelectItem value="America/Toronto">America/Toronto</SelectItem>
                                <SelectItem value="Europe/London">Europe/London</SelectItem>
                                <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                                <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                                <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                                <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-industry">
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="fine_dining">Fine Dining</SelectItem>
                                <SelectItem value="casual_dining">Casual Dining</SelectItem>
                                <SelectItem value="catering">Catering</SelectItem>
                                <SelectItem value="hotel">Hotel</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="testing">Testing</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Set to "Active" when ready to deploy
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="greetingMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Greeting Message</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="What the agent says when answering the phone"
                                className="min-h-20"
                                {...field}
                                data-testid="textarea-greeting"
                              />
                            </FormControl>
                            <FormDescription>
                              This is the first thing customers hear when calling
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="personality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Personality</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Warm, professional, and attentive"
                                {...field}
                                data-testid="input-personality"
                              />
                            </FormControl>
                            <FormDescription>
                              Describe how the agent should communicate
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="systemPrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>System Prompt</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Instructions for the AI agent..."
                                className="min-h-32 font-mono text-sm"
                                {...field}
                                data-testid="textarea-system-prompt"
                              />
                            </FormControl>
                            <FormDescription>
                              Detailed instructions that guide the agent's behavior
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customVocabulary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Vocabulary</FormLabel>
                            <FormDescription>Teach your agent custom pronunciations (comma-separated)</FormDescription>
                            <FormControl>
                              <Input
                                placeholder="e.g., Bella's, Risotto, Charcuterie"
                                {...field}
                                value={field.value?.join(", ") || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value ? value.split(",").map(s => s.trim()).filter(Boolean) : []);
                                }}
                                data-testid="input-custom-vocabulary"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="filterWords"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Filter Words</FormLabel>
                            <FormDescription>Words to remove or replace (comma-separated)</FormDescription>
                            <FormControl>
                              <Input
                                placeholder="e.g., profanity, slang terms"
                                {...field}
                                value={field.value?.join(", ") || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value ? value.split(",").map(s => s.trim()).filter(Boolean) : []);
                                }}
                                data-testid="input-filter-words"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="useFillerWords"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Use Filler Words</FormLabel>
                              <FormDescription>
                                Allow natural speech patterns like "um", "uh", "you know"
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-filler-words"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="repeatCustomerRecognition"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-primary/5">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Repeat Customer Recognition</FormLabel>
                              <FormDescription>
                                Recognize returning callers by phone number and offer to reorder their previous items
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value ?? true}
                                onCheckedChange={field.onChange}
                                data-testid="switch-repeat-customer"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="voice" className="space-y-6">
                  <Form {...form}>
                    <form className="space-y-6">
                      {/* LLM Model Selection */}
                      <FormField
                        control={form.control}
                        name="aiModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AI Model</FormLabel>
                            <FormDescription>Select the language model that powers your agent's responses</FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-ai-model">
                                  <SelectValue placeholder="Select AI model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="gpt-4o">
                                  <div className="flex items-center justify-between gap-4 w-full">
                                    <span>GPT-4o</span>
                                    <Badge variant="secondary" className="text-xs">Premium</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="gpt-4o-mini">
                                  <div className="flex items-center justify-between gap-4 w-full">
                                    <span>GPT-4o Mini</span>
                                    <Badge variant="outline" className="text-xs">Recommended</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="claude-3.5-sonnet">
                                  <div className="flex items-center justify-between gap-4 w-full">
                                    <span>Claude 3.5 Sonnet</span>
                                    <Badge variant="secondary" className="text-xs">Premium</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="claude-3-haiku">
                                  <div className="flex items-center justify-between gap-4 w-full">
                                    <span>Claude 3 Haiku</span>
                                    <Badge variant="outline" className="text-xs">Fast</Badge>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="language"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Language</FormLabel>
                            <FormDescription>The language that your agent will speak and understand</FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-language">
                                  <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="en-US">English (US)</SelectItem>
                                <SelectItem value="en-GB">English (UK)</SelectItem>
                                <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                                <SelectItem value="es-419">Spanish (Latin America)</SelectItem>
                                <SelectItem value="fr-FR">French</SelectItem>
                                <SelectItem value="de-DE">German</SelectItem>
                                <SelectItem value="it-IT">Italian</SelectItem>
                                <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                                <SelectItem value="ja-JP">Japanese</SelectItem>
                                <SelectItem value="zh-CN">Chinese (Mandarin)</SelectItem>
                                <SelectItem value="ko-KR">Korean</SelectItem>
                                <SelectItem value="nl-NL">Dutch</SelectItem>
                                <SelectItem value="hi-IN">Hindi</SelectItem>
                                <SelectItem value="ar-SA">Arabic</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voiceProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voice Provider</FormLabel>
                            <FormDescription>Select the text-to-speech service for your agent</FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-voice-provider">
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="elevenlabs">
                                  <div className="flex items-center gap-2">
                                    <span>ElevenLabs</span>
                                    <Badge variant="secondary" className="text-xs">Premium</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="openai">
                                  <div className="flex items-center gap-2">
                                    <span>OpenAI TTS</span>
                                    <Badge variant="outline" className="text-xs">Fast</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="cartesia">
                                  <div className="flex items-center gap-2">
                                    <span>Cartesia</span>
                                    <Badge variant="outline" className="text-xs">Low Latency</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="deepgram">
                                  <div className="flex items-center gap-2">
                                    <span>Deepgram</span>
                                    <Badge variant="outline" className="text-xs">Speed</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="playht">
                                  <div className="flex items-center gap-2">
                                    <span>PlayHT</span>
                                    <Badge variant="outline" className="text-xs">Cloning</Badge>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voiceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voice</FormLabel>
                            <FormDescription>Choose the voice personality for your agent</FormDescription>
                            {field.value ? (
                              <Card className="overflow-hidden">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="font-medium mb-1">
                                        {selectedVoiceName || field.value}
                                      </div>
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <Badge variant="secondary" className="text-xs">
                                          {form.watch("voiceProvider") === "openai" ? "OpenAI" : "ElevenLabs"}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs font-mono">
                                          ID: {field.value}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            const provider = form.watch("voiceProvider") || "openai";
                                            const response = await fetch(`/api/voices/${provider}/preview`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ 
                                                voiceId: field.value,
                                                text: "Hello! How can I help you today?"
                                              })
                                            });
                                            
                                            if (!response.ok) throw new Error("Preview failed");
                                            
                                            const blob = await response.blob();
                                            const url = URL.createObjectURL(blob);
                                            const audio = new Audio(url);
                                            audio.play();
                                          } catch (error) {
                                            console.error("Voice preview failed:", error);
                                            toast({
                                              title: "Error",
                                              description: "Failed to preview voice",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        className="gap-2"
                                        data-testid="button-listen-voice"
                                      >
                                        <Volume2 className="h-4 w-4" />
                                        Listen
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="default"
                                        size="sm"
                                        onClick={() => setVoiceSelectorOpen(true)}
                                        data-testid="button-edit-voice"
                                      >
                                        Edit
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() => setVoiceSelectorOpen(true)}
                                data-testid="button-select-voice"
                              >
                                Select Voice
                              </Button>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="patienceLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Patience Level</FormLabel>
                            <FormDescription>How long the agent waits before responding</FormDescription>
                            <FormControl>
                              <div className="grid grid-cols-3 gap-3">
                                <Card
                                  className={`cursor-pointer transition-all hover-elevate ${
                                    field.value === "low" ? "ring-2 ring-primary" : ""
                                  }`}
                                  onClick={() => field.onChange("low")}
                                  data-testid="card-patience-low"
                                >
                                  <CardContent className="p-4 text-center">
                                    <Zap className="h-6 w-6 mx-auto mb-2" />
                                    <div className="font-medium">Low</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Quick responses
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card
                                  className={`cursor-pointer transition-all hover-elevate ${
                                    field.value === "medium" ? "ring-2 ring-primary" : ""
                                  }`}
                                  onClick={() => field.onChange("medium")}
                                  data-testid="card-patience-medium"
                                >
                                  <CardContent className="p-4 text-center">
                                    <Clock className="h-6 w-6 mx-auto mb-2" />
                                    <div className="font-medium">Medium</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Balanced
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card
                                  className={`cursor-pointer transition-all hover-elevate ${
                                    field.value === "high" ? "ring-2 ring-primary" : ""
                                  }`}
                                  onClick={() => field.onChange("high")}
                                  data-testid="card-patience-high"
                                >
                                  <CardContent className="p-4 text-center">
                                    <Timer className="h-6 w-6 mx-auto mb-2" />
                                    <div className="font-medium">High</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Thoughtful pauses
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="speechRecognition"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enhanced Speech Recognition</FormLabel>
                              <FormDescription>
                                Improve accuracy for accents and background noise
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-speech-recognition"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voiceSpeed"
                        render={({ field }) => {
                          const numValue = parseFloat(field.value) || 1.0;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Voice Speed</FormLabel>
                                <span className="text-sm text-muted-foreground">{numValue.toFixed(1)}x</span>
                              </div>
                              <FormDescription>Adjust how fast your agent speaks</FormDescription>
                              <FormControl>
                                <Slider
                                  min={0.5}
                                  max={2.0}
                                  step={0.1}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(vals[0].toFixed(1))}
                                  data-testid="slider-voice-speed"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="voiceVolume"
                        render={({ field }) => {
                          const numValue = parseFloat(field.value) || 100;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Voice Volume</FormLabel>
                                <span className="text-sm text-muted-foreground">{Math.round(numValue)}%</span>
                              </div>
                              <FormDescription>Control the output volume level</FormDescription>
                              <FormControl>
                                <Slider
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(String(vals[0]))}
                                  data-testid="slider-voice-volume"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="interruptionSensitivity"
                        render={({ field }) => {
                          const numValue = parseFloat(field.value) || 1.0;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Interruption Sensitivity</FormLabel>
                                <span className="text-sm text-muted-foreground">{numValue.toFixed(1)}</span>
                              </div>
                              <FormDescription>
                                How easily the agent can be interrupted while speaking
                              </FormDescription>
                              <FormControl>
                                <Slider
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(vals[0].toFixed(1))}
                                  data-testid="slider-interruption-sensitivity"
                                />
                              </FormControl>
                              <div className="flex justify-between text-xs text-muted-foreground px-1">
                                <span>Hard to interrupt</span>
                                <span>Easy to interrupt</span>
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="responsiveness"
                        render={({ field }) => {
                          const numValue = parseFloat(field.value) || 1.0;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Responsiveness</FormLabel>
                                <span className="text-sm text-muted-foreground">{numValue.toFixed(1)}</span>
                              </div>
                              <FormDescription>
                                How quickly the agent responds after the user stops speaking
                              </FormDescription>
                              <FormControl>
                                <Slider
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(vals[0].toFixed(1))}
                                  data-testid="slider-responsiveness"
                                />
                              </FormControl>
                              <div className="flex justify-between text-xs text-muted-foreground px-1">
                                <span>Slower (more thoughtful)</span>
                                <span>Faster (more reactive)</span>
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Backchannel Settings */}
                      <FormField
                        control={form.control}
                        name="enableBackchannel"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Backchannel</FormLabel>
                              <FormDescription>
                                Agent uses natural acknowledgments like "yeah", "uh-huh", "I see" while listening
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-enable-backchannel"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("enableBackchannel") && (
                        <FormField
                          control={form.control}
                          name="backchannelFrequency"
                          render={({ field }) => {
                            const numValue = parseFloat(field.value) || 0.9;
                            return (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>Backchannel Frequency</FormLabel>
                                  <span className="text-sm text-muted-foreground">{(numValue * 100).toFixed(0)}%</span>
                                </div>
                                <FormDescription>
                                  How often the agent uses acknowledgment phrases
                                </FormDescription>
                                <FormControl>
                                  <Slider
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={[numValue]}
                                    onValueChange={(vals) => field.onChange(vals[0].toFixed(1))}
                                    data-testid="slider-backchannel-frequency"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      )}

                      {/* Ambient Sound */}
                      <FormField
                        control={form.control}
                        name="ambientSound"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ambient Sound</FormLabel>
                            <FormDescription>Add background ambiance to make calls feel more natural</FormDescription>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-ambient-sound">
                                  <SelectValue placeholder="No ambient sound" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                <SelectItem value="coffee-shop">Coffee Shop</SelectItem>
                                <SelectItem value="office">Office</SelectItem>
                                <SelectItem value="summer-outdoor">Summer Outdoor</SelectItem>
                                <SelectItem value="convention-hall">Convention Hall</SelectItem>
                                <SelectItem value="static">Slight Static</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>

                  <VoiceSelector
                    open={voiceSelectorOpen}
                    onOpenChange={setVoiceSelectorOpen}
                    provider={form.watch("voiceProvider") || "openai"}
                    selectedVoiceId={form.watch("voiceId") || ""}
                    onSelectVoice={(voiceId, voiceName) => {
                      form.setValue("voiceId", voiceId);
                      setSelectedVoiceName(voiceName);
                      setVoiceSelectorOpen(false);
                    }}
                  />
                </TabsContent>

                <TabsContent value="call-config" className="space-y-6">
                  <Form {...form}>
                    <form className="space-y-6">
                      {/* Begin Message Delay */}
                      <FormField
                        control={form.control}
                        name="beginMessageDelayMs"
                        render={({ field }) => {
                          const numValue = parseInt(field.value) || 1000;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Begin Message Delay</FormLabel>
                                <span className="text-sm text-muted-foreground">{(numValue / 1000).toFixed(1)}s</span>
                              </div>
                              <FormDescription>
                                How long to wait before the agent speaks after call connects
                              </FormDescription>
                              <FormControl>
                                <Slider
                                  min={0}
                                  max={5000}
                                  step={100}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(String(vals[0]))}
                                  data-testid="slider-begin-message-delay"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Inactivity Timeout */}
                      <FormField
                        control={form.control}
                        name="inactivityTimeoutMs"
                        render={({ field }) => {
                          const numValue = parseInt(field.value) || 30000;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Inactivity Timeout</FormLabel>
                                <span className="text-sm text-muted-foreground">{(numValue / 1000).toFixed(0)}s</span>
                              </div>
                              <FormDescription>
                                End call after this much silence from the caller
                              </FormDescription>
                              <FormControl>
                                <Slider
                                  min={10000}
                                  max={120000}
                                  step={5000}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(String(vals[0]))}
                                  data-testid="slider-inactivity-timeout"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Max Call Duration */}
                      <FormField
                        control={form.control}
                        name="maxCallDurationMs"
                        render={({ field }) => {
                          const numValue = parseInt(field.value) || 3600000;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Max Call Duration</FormLabel>
                                <span className="text-sm text-muted-foreground">{(numValue / 60000).toFixed(0)} min</span>
                              </div>
                              <FormDescription>
                                Maximum length of a single call before automatic disconnect
                              </FormDescription>
                              <FormControl>
                                <Slider
                                  min={60000}
                                  max={3600000}
                                  step={60000}
                                  value={[numValue]}
                                  onValueChange={(vals) => field.onChange(String(vals[0]))}
                                  data-testid="slider-max-call-duration"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Reminder Settings */}
                      <div className="rounded-lg border p-4 space-y-4">
                        <div className="font-medium">Reminder Settings</div>
                        <FormField
                          control={form.control}
                          name="reminderTriggerMs"
                          render={({ field }) => {
                            const numValue = parseInt(field.value) || 10000;
                            return (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>Reminder Trigger</FormLabel>
                                  <span className="text-sm text-muted-foreground">{(numValue / 1000).toFixed(0)}s</span>
                                </div>
                                <FormDescription>
                                  Send reminder after this much silence
                                </FormDescription>
                                <FormControl>
                                  <Slider
                                    min={5000}
                                    max={30000}
                                    step={1000}
                                    value={[numValue]}
                                    onValueChange={(vals) => field.onChange(String(vals[0]))}
                                    data-testid="slider-reminder-trigger"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        <FormField
                          control={form.control}
                          name="reminderMaxCount"
                          render={({ field }) => {
                            const numValue = parseInt(field.value) || 2;
                            return (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>Max Reminders</FormLabel>
                                  <span className="text-sm text-muted-foreground">{numValue}</span>
                                </div>
                                <FormDescription>
                                  Maximum number of reminders before ending call
                                </FormDescription>
                                <FormControl>
                                  <Slider
                                    min={1}
                                    max={5}
                                    step={1}
                                    value={[numValue]}
                                    onValueChange={(vals) => field.onChange(String(vals[0]))}
                                    data-testid="slider-reminder-max-count"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        <FormField
                          control={form.control}
                          name="reminderMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reminder Message</FormLabel>
                              <FormDescription>What the agent says to prompt the caller</FormDescription>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="I'm still here. Do you have any questions?"
                                  data-testid="input-reminder-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Voicemail Detection */}
                      <FormField
                        control={form.control}
                        name="voicemailDetection"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Voicemail Detection</FormLabel>
                              <FormDescription>
                                Detect voicemail and leave a message automatically
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-voicemail-detection"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("voicemailDetection") && (
                        <FormField
                          control={form.control}
                          name="voicemailMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Voicemail Message</FormLabel>
                              <FormDescription>Message to leave on voicemail</FormDescription>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Hi, this is a message from your AI assistant..."
                                  className="min-h-[100px]"
                                  data-testid="textarea-voicemail-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Warm Transfer */}
                      <FormField
                        control={form.control}
                        name="warmTransferEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Warm Transfer</FormLabel>
                              <FormDescription>
                                Transfer calls to a human when requested
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-warm-transfer"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("warmTransferEnabled") && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="warmTransferNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Transfer Phone Number</FormLabel>
                                <FormDescription>Phone number to transfer calls to</FormDescription>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="+1 (555) 123-4567"
                                    data-testid="input-warm-transfer-number"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="warmTransferMessage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Transfer Message</FormLabel>
                                <FormDescription>What the agent says before transferring</FormDescription>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="I'm transferring you to a team member now..."
                                    data-testid="input-warm-transfer-message"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          {!isNew && id && (
            <FlowBuilder 
              agentId={id} 
              initialNodes={initialNodes}
              initialEdges={initialEdges}
              onSave={handleSaveFlow}
            />
          )}
        </TabsContent>

        <TabsContent value="test">
          {!isNew && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Test Conversation</CardTitle>
                    <CardDescription>
                      {testMode === "text" 
                        ? "Have a text conversation with your agent to test its responses"
                        : testMode === "voice"
                        ? "Record voice messages and hear the agent respond"
                        : "Simulate a real phone call with your AI agent"
                      }
                    </CardDescription>
                  </div>
                  <ToggleGroup 
                    type="single" 
                    value={testMode} 
                    onValueChange={(value) => value && setTestMode(value as "text" | "voice" | "call")}
                    data-testid="toggle-test-mode"
                  >
                    <ToggleGroupItem value="text" aria-label="Text mode" data-testid="toggle-text-mode">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Text
                    </ToggleGroupItem>
                    <ToggleGroupItem value="voice" aria-label="Voice mode" data-testid="toggle-voice-mode">
                      <Mic className="h-4 w-4 mr-2" />
                      Voice
                    </ToggleGroupItem>
                    <ToggleGroupItem value="call" aria-label="Call mode" data-testid="toggle-call-mode">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-2xl p-4 min-h-[400px] max-h-[500px] overflow-y-auto bg-muted/30">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[350px]">
                        <Button
                          size="lg"
                          onClick={() => {
                            if (testMode === "call") {
                              startTestCall();
                            } else {
                              // For text/voice modes, trigger agent greeting first
                              handleStartTestChat();
                            }
                          }}
                          disabled={testMutation.isPending || callState !== "idle"}
                          className="gap-2 px-8 py-6 text-lg rounded-full"
                          data-testid="button-start-test-chat"
                        >
                          <MessageSquare className="h-5 w-5" />
                          Start Test Agent Chat
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border"
                              }`}
                              data-testid={`message-${msg.role}-${i}`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {testMutation.isPending && (
                          <div className="flex justify-start">
                            <div className="bg-card border rounded-2xl px-4 py-2">
                              <p className="text-sm text-muted-foreground">Thinking...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {testMode === "text" ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendTest()}
                        disabled={testMutation.isPending}
                        data-testid="input-test-message"
                      />
                      <Button
                        onClick={handleSendTest}
                        disabled={!testInput.trim() || testMutation.isPending}
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : testMode === "voice" ? (
                    <div className="flex flex-col items-center gap-4">
                      <Button
                        size="lg"
                        variant={isRecording ? "destructive" : "default"}
                        className="h-24 w-24 rounded-full"
                        onClick={handleVoiceButtonClick}
                        disabled={isProcessing}
                        data-testid="button-voice-record"
                      >
                        {isRecording ? (
                          <MicOff className="h-10 w-10" />
                        ) : (
                          <Mic className="h-10 w-10" />
                        )}
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        {isRecording 
                          ? "Tap to stop recording" 
                          : isProcessing
                          ? "Processing your message..."
                          : "Tap to start speaking"
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6 py-4">
                      {callState === "idle" ? (
                        <div className="text-center">
                          <Button
                            size="lg"
                            className="h-20 w-20 rounded-full bg-green-600 hover:bg-green-700"
                            onClick={startTestCall}
                            data-testid="button-start-call"
                          >
                            <Phone className="h-8 w-8" />
                          </Button>
                          <p className="text-sm text-muted-foreground mt-4">
                            Start a voice call with your agent using your microphone
                          </p>
                        </div>
                      ) : (
                        <div className="w-full space-y-4">
                          <div className="flex items-center justify-center gap-3">
                            <div className={`h-3 w-3 rounded-full ${
                              callState === "connecting" ? "bg-yellow-500 animate-pulse" :
                              callState === "speaking" ? "bg-green-500 animate-pulse" :
                              callState === "listening" ? "bg-blue-500 animate-pulse" :
                              callState === "processing" ? "bg-orange-500 animate-pulse" :
                              "bg-green-500"
                            }`} />
                            <span className="text-sm font-medium capitalize">
                              {callState === "connecting" ? "Connecting..." :
                               callState === "speaking" ? "Agent Speaking" :
                               callState === "listening" ? (useMicFallback ? "Your Turn" : "Listening...") :
                               callState === "processing" ? "Processing..." :
                               callState === "greeting" ? "Starting Call..." :
                               "In Call"}
                            </span>
                          </div>
                          
                          {useMicFallback && callState === "listening" && (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Type what you would say..."
                                value={testInput}
                                onChange={(e) => setTestInput(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && sendTestCallText(testInput)}
                                data-testid="input-call-message"
                              />
                              <Button
                                onClick={() => sendTestCallText(testInput)}
                                disabled={!testInput.trim()}
                                data-testid="button-send-call-message"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          
                          <div className="flex justify-center items-center gap-4">
                            {!useMicFallback && (
                              <Button
                                size="lg"
                                variant={isMicMuted ? "outline" : "default"}
                                className={`h-14 w-14 rounded-full ${
                                  isMicMuted ? "bg-muted" : "bg-primary"
                                }`}
                                onClick={toggleMicMute}
                                data-testid="button-toggle-mute"
                              >
                                {isMicMuted ? (
                                  <MicOff className="h-5 w-5" />
                                ) : (
                                  <Mic className="h-5 w-5" />
                                )}
                              </Button>
                            )}
                            
                            <Button
                              size="lg"
                              variant="destructive"
                              className="h-14 w-14 rounded-full"
                              onClick={endTestCall}
                              data-testid="button-end-call"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          </div>
                          
                          <p className="text-xs text-muted-foreground text-center">
                            {useMicFallback
                              ? (callState === "listening" 
                                ? "Type a message to simulate what you would say"
                                : callState === "speaking" 
                                ? "Agent is responding..."
                                : callState === "processing"
                                ? "Processing..."
                                : "Call in progress (text mode)")
                              : (isMicMuted 
                              ? "Microphone is muted"
                              : callState === "listening" 
                              ? "Speak now - your voice is being recorded"
                              : callState === "speaking" 
                              ? "Agent is responding..."
                              : callState === "processing"
                              ? "Processing your speech..."
                              : "Call in progress")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {messages.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setMessages([])}
                      data-testid="button-clear-conversation"
                    >
                      Clear Conversation
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
