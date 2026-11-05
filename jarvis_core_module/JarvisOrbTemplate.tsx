import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Loader2,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Key,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: any[];
  timestamp: Date;
}

export const JarvisOrb: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Namaste! Main PhoneZone ka AI Assistant JARVIS hoon. Bolkar ya type karke koi bhi kaam karein — jaise: 'Aaj kitni bikri hui?', 'Parso bika hua phone dhundo', ya 'Ek phone kharida hai entry karo'.",
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check AI Configuration
  const { data: aiConfig } = useQuery({
    queryKey: ["ai-config"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config", { credentials: "include" });
      return res.ok ? res.json() : null;
    },
  });

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "hi-IN"; // Supports Hindi & Indian English mixed

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          // Automatically dispatch spoken query
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. Please allow mic in browser.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }
  }, []);

  // Speech synthesis voice selection
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    return localStorage.getItem("jarvis_preferred_voice") || "";
  });
  const [showVoicePicker, setShowVoicePicker] = useState<boolean>(false);

  // Load and select the best Indian voice
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      if (!allVoices || allVoices.length === 0) return;
      setVoices(allVoices);

      const saved = localStorage.getItem("jarvis_preferred_voice");
      if (saved && allVoices.some((v) => v.voiceURI === saved)) {
        setSelectedVoiceURI(saved);
        return;
      }

      // Best natural voice selection cascade:
      // 1. Natural Indian Hindi / English (Swara, Madhur, Neerja, Heera, Google हिन्दी, Google English India)
      const best = 
        allVoices.find((v) => /swara|madhur|हिन्दी/i.test(v.name)) ||
        allVoices.find((v) => v.lang === "hi-IN" || v.lang === "hi_IN") ||
        allVoices.find((v) => /neerja|heera|prabhat/i.test(v.name)) ||
        allVoices.find((v) => v.lang === "en-IN" || v.lang === "en_IN") ||
        allVoices.find((v) => /india/i.test(v.name)) ||
        allVoices.find((v) => v.default) ||
        allVoices[0];

      if (best) {
        setSelectedVoiceURI(best.voiceURI);
        localStorage.setItem("jarvis_preferred_voice", best.voiceURI);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Text-To-Speech (TTS) Voice playback
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();

      // Clean speech text thoroughly so Indian TTS speaks smoothly without spelling letters
      let clean = text
        // Replace ₹ with "rupaye"
        .replace(/₹\s*([0-9,]+)/g, "$1 rupaye ")
        .replace(/₹/g, " rupaye ")
        // Remove markdown formatting
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/[*#_`~>]/g, " ")
        .replace(/\[.*?\]\(.*?\)/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        // Remove bullet markers and list numbers
        .replace(/^\s*[\*\-]\s+/gm, " ")
        .replace(/^\s*\d+[\.\)]\s+/gm, " ")
        // Replace colons, slashes with natural pauses
        .replace(/:\s*/g, ", ")
        .replace(/\//g, " ya ")
        // Clean multiple whitespace
        .replace(/\s+/g, " ")
        .trim();

      const utterance = new SpeechSynthesisUtterance(clean);

      const activeVoice = voices.find((v) => v.voiceURI === selectedVoiceURI) ||
        voices.find((v) => v.lang.startsWith("hi") || v.lang.startsWith("en-IN")) ||
        null;

      if (activeVoice) {
        utterance.voice = activeVoice;
        utterance.lang = activeVoice.lang;
      } else {
        utterance.lang = "hi-IN";
      }

      // 0.92 rate provides calm, articulate, natural human cadence without rushing syllables
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS Error:", e);
      setIsSpeaking(false);
    }
  };

  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceURI(uri);
    localStorage.setItem("jarvis_preferred_voice", uri);
    // Preview speech with the selected voice
    const chosen = voices.find((v) => v.voiceURI === uri);
    if (chosen) {
      const u = new SpeechSynthesisUtterance("Namaste bhaiya, main PhoneZone AI assistant hoon.");
      u.voice = chosen;
      u.lang = chosen.lang;
      u.rate = 0.92;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Chat Mutation
  const chatMutation = useMutation({
    mutationFn: async (userMsg: string) => {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: userMsg,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "JARVIS failed to process request");
      return data;
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: "msg_" + Date.now(),
        role: "assistant",
        content: data.reply,
        toolResults: data.toolResults || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // If autoSpeak enabled, read reply aloud
      if (data.autoSpeak || isListening) {
        speakText(data.reply);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to communicate with JARVIS");
      setMessages((prev) => [
        ...prev,
        {
          id: "err_" + Date.now(),
          role: "assistant",
          content: `⚠️ Maaf kijiye, ek dikkat aayi: ${err.message}. Kripya Settings me jakar AI API Key check karein.`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || chatMutation.isPending) return;

    const userMsg: Message = {
      id: "usr_" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    chatMutation.mutate(query);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition not supported in this browser. Use Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info("Sun raha hoon... Boliye!", { duration: 2000 });
      } catch (e) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  };

  return (
    <>
      {/* Floating JARVIS Orb Button */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 group">
          <span className="hidden sm:inline-block bg-slate-900/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg border border-slate-700/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
            Ask JARVIS Copilot 🎙️
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center transition-transform transform hover:scale-105 active:scale-95 border-2 border-white/40 focus:outline-none"
            aria-label="Open JARVIS AI Copilot"
          >
            <Sparkles className="h-7 w-7 text-white animate-pulse" />
          </button>
        </div>
      )}

      {/* Floating JARVIS Chat & Voice Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[420px] max-h-[85vh] h-[580px] bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 px-4 flex items-center justify-between border-b border-indigo-800/50 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-indigo-600/80 border border-indigo-400/50 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-sky-300 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  JARVIS Copilot
                  <Badge className="text-[9px] py-0 px-1.5 bg-indigo-500/40 text-indigo-200 border-indigo-400/30">
                    {aiConfig?.provider ? aiConfig.provider.toUpperCase() : "AI ACTIVE"}
                  </Badge>
                </h3>
                <p className="text-[10px] text-indigo-200/80">Voice &amp; Text Store Automation</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowVoicePicker((prev) => !prev)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showVoicePicker
                    ? "bg-indigo-600 text-white"
                    : "text-indigo-300 hover:text-white hover:bg-white/10"
                }`}
                title="Voice / Aawaz Settings"
              >
                <Volume2 className="h-4 w-4" />
              </button>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className="p-1.5 text-emerald-400 hover:text-white rounded-lg transition-colors animate-pulse"
                  title="Stop voice playback"
                >
                  <VolumeX className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Minimize"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Voice Selector Bar (Collapsible) */}
          {showVoicePicker && (
            <div className="bg-slate-900 border-b border-indigo-900/60 p-2.5 px-3 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-sky-400 flex items-center gap-1">
                  🎙️ AI Aawaz (Voice Selection):
                </span>
                <span className="text-[10px] text-slate-400">
                  Select best Indian Hindi voice
                </span>
              </div>
              <select
                value={selectedVoiceURI}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full h-8 px-2 text-xs rounded bg-slate-950 text-white border border-slate-700 focus:outline-none focus:border-indigo-500"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Suggestion Chips */}
          <div className="p-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <button
              type="button"
              onClick={() => handleSendMessage("Aaj ki bikri aur munafa kitna hua?")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              📊 Aaj ki bikri?
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Parso kaunsa phone bika tha?")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              🔍 Parso ki bikri?
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Stock me kaunse phones hain?")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              📱 Available stock?
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-xs ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

                  {/* Tool execution badges */}
                  {m.toolResults && m.toolResults.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                      {m.toolResults.map((tr: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-1 px-2 rounded font-mono"
                        >
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Action: {tr.toolName} executed</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>JARVIS soch raha hai aur kaam execute kar raha hai...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input & Mic Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleListening}
                className={`h-9 w-9 rounded-full shrink-0 transition-colors ${
                  isListening
                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse"
                    : "hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                }`}
                title={isListening ? "Listening... Click to stop" : "Click to speak voice command"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Input
                placeholder={isListening ? "Sun raha hoon... Boliye!" : "Bolkar ya type karke puchein..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="text-xs h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />

              <Button
                type="submit"
                size="icon"
                disabled={!inputText.trim() || chatMutation.isPending}
                className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default JarvisOrb;
