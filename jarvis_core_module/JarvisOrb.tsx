import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  Volume2,
  VolumeX,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  Share2,
  FileText,
  PenTool,
  RotateCcw,
  ExternalLink,
  Upload,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: any[];
  dealData?: any;
  attachedImages?: string[];
  timestamp: Date;
}

// -------------------------------------------------------------
// Client-Side Image Compressor (Ensures super-fast upload & 0 latency)
// -------------------------------------------------------------
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

// -------------------------------------------------------------
// Interactive Signature Pad Canvas
// -------------------------------------------------------------
const SignaturePad: React.FC<{
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}> = ({ onSave, onClear }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear();
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
        <span className="font-semibold flex items-center gap-1 text-indigo-900 dark:text-indigo-300">
          <PenTool className="h-3 w-3" /> Draw Signature on Screen:
        </span>
        {hasSignature && (
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-rose-500 hover:text-rose-700 flex items-center gap-0.5 font-medium"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Clear
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={340}
        height={90}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-[90px] bg-white border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg cursor-crosshair touch-none shadow-inner"
      />
      {!hasSignature && (
        <p className="text-[10px] text-slate-400 italic">Finger ya mouse se screen par sign karein</p>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// 3 Signature Options Component (Draw, Upload, Saved/Mobile)
// -------------------------------------------------------------
const SignatureSelector: React.FC<{
  dealId: string;
  savedSignature?: string | null;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}> = ({ dealId, savedSignature, onSave, onClear }) => {
  const [mode, setMode] = useState<"draw" | "upload" | "saved">(savedSignature ? "saved" : "draw");
  const [currentSig, setCurrentSig] = useState<string | null>(savedSignature || null);
  const uploadSigInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (savedSignature && !currentSig) {
      setCurrentSig(savedSignature);
      onSave(savedSignature);
    }
  }, [savedSignature]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCurrentSig(reader.result);
        onSave(reader.result);
        toast.success("Signature photo uploaded successfully!");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleApplySaved = () => {
    if (savedSignature) {
      setCurrentSig(savedSignature);
      onSave(savedSignature);
      toast.success("Saved signature applied from previous records!");
    }
  };

  const handleRemove = () => {
    setCurrentSig(null);
    onClear();
  };

  return (
    <div className="space-y-2 pt-1 border-t border-indigo-200 dark:border-indigo-800/60">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
          <PenTool className="h-3.5 w-3.5 text-indigo-600" />
          Customer Digital Signature (3 Options):
        </span>
        {currentSig && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-0.5"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Remove
          </button>
        )}
      </div>

      {/* 3 Option Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg text-[10px] font-semibold">
        <button
          type="button"
          onClick={() => setMode("draw")}
          className={`py-1 rounded text-center transition-colors ${
            mode === "draw"
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          ✍️ Draw (Screen)
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`py-1 rounded text-center transition-colors ${
            mode === "upload"
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          📁 Upload Photo
        </button>
        <button
          type="button"
          onClick={() => setMode("saved")}
          className={`py-1 rounded text-center transition-colors ${
            mode === "saved"
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          📱 Saved / Mobile
        </button>
      </div>

      {/* Current signature preview banner if set */}
      {currentSig && (
        <div className="flex items-center gap-2 p-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="h-10 w-24 bg-white rounded border border-emerald-300 p-0.5 flex items-center justify-center shrink-0">
            <img src={currentSig} alt="Signature" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex-1 text-[10px] text-emerald-800 dark:text-emerald-300">
            <span className="font-bold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Signature Attached
            </span>
            <span className="text-[9px] text-slate-500">Ready for legal Sapath Patra & purchase bill</span>
          </div>
        </div>
      )}

      {/* Option 1: Draw on Canvas */}
      {mode === "draw" && (
        <SignaturePad
          onSave={(dataUrl) => {
            setCurrentSig(dataUrl);
            onSave(dataUrl);
          }}
          onClear={handleRemove}
        />
      )}

      {/* Option 2: Upload Signature Image */}
      {mode === "upload" && (
        <div className="space-y-1.5">
          <input
            ref={uploadSigInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => uploadSigInputRef.current?.click()}
            className="w-full h-12 border-dashed border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 flex items-center justify-center gap-2 text-xs"
          >
            <Upload className="h-4 w-4" />
            <span>Kagaz par sign ki photo ya signature file upload karein</span>
          </Button>
        </div>
      )}

      {/* Option 3: Saved Signature or Mobile */}
      {mode === "saved" && (
        <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs">
          {savedSignature ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-10 w-20 bg-slate-50 border rounded p-0.5 flex items-center justify-center">
                  <img src={savedSignature} alt="Saved" className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    Previous Saved Signature
                  </p>
                  <p className="text-[9px] text-slate-400">Seller ke purane purchase record se</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleApplySaved}
                className="h-7 text-[10px] bg-purple-700 hover:bg-purple-800 text-white font-bold"
              >
                Apply
              </Button>
            </div>
          ) : (
            <div className="text-center py-2 space-y-1">
              <p className="text-[11px] text-slate-500">
                Is seller ka koi purana signature nahi mila.
              </p>
              <p className="text-[10px] text-indigo-600 font-medium">
                Kripya <b>Draw</b> ya <b>Upload Photo</b> tab use karke sign lein.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const JarvisOrb: React.FC = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem("jarvis_muted") === "true";
  });
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [dealSignatures, setDealSignatures] = useState<Record<string, string>>({});
  const [savingDealId, setSavingDealId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Messages State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Namaste! Main PhoneZone ka AI Assistant JARVIS hoon. Bolkar, type karke ya photos attach karke koi bhi kaam karein — jaise: 'Realme phone ki invoice dikhao', 'Aaj kitni bikri hui?', ya phone/aadhaar photos bhej kar instant purchase entry karein.",
      timestamp: new Date(),
    },
  ]);

  // Voice Selection State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    return localStorage.getItem("jarvis_preferred_voice") || "";
  });
  const [showVoicePicker, setShowVoicePicker] = useState<boolean>(false);

  // Check AI Configuration
  const { data: aiConfig } = useQuery({
    queryKey: ["ai-config"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config", { credentials: "include" });
      return res.ok ? res.json() : null;
    },
  });

  // Load voices
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

  // Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "hi-IN";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Clean and speak text
  const speakText = (text: string) => {
    if (isMuted || !("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();

      // Clean text for natural cadence and Hindi number pronunciation
      let clean = text
        .replace(/₹\s*([0-9,]+)/g, "$1 rupaye ")
        .replace(/₹/g, " rupaye ")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/[*#_`~>]/g, " ")
        .replace(/\[.*?\]\(.*?\)/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/^\s*[\*\-]\s+/gm, " ")
        .replace(/^\s*\d+[\.\)]\s+/gm, " ")
        .replace(/:\s*/g, ", ")
        .replace(/\//g, " ya ")
        .replace(/\s+/g, " ")
        .trim();

      const utterance = new SpeechSynthesisUtterance(clean);
      const activeVoice =
        voices.find((v) => v.voiceURI === selectedVoiceURI) ||
        voices.find((v) => v.lang.startsWith("hi") || v.lang.startsWith("en-IN")) ||
        null;

      if (activeVoice) {
        utterance.voice = activeVoice;
        utterance.lang = activeVoice.lang;
      } else {
        utterance.lang = "hi-IN";
      }

      // 1.15x speed ensures energetic, articulate, fast & natural speech without dragging
      utterance.rate = 1.15;
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

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem("jarvis_muted", String(next));
    if (next) stopSpeaking();
    toast.info(next ? "AI Audio Muted 🔇" : "AI Audio Unmuted 🔊");
  };

  // Image Upload Handler with Instant Client-Side Compression
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    toast.loading("Compressing & preparing photos...", { id: "compress-img" });
    const compressedList: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const c = await compressImage(file);
        if (c) compressedList.push(c);
      } catch {
        // skip corrupted
      }
    }
    setAttachedFiles((prev) => [...prev, ...compressedList]);
    toast.success(`${compressedList.length} photos ready for AI Intake!`, { id: "compress-img" });
    e.target.value = "";
  };

  const removeAttachedImage = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Chat Mutation
  const chatMutation = useMutation({
    mutationFn: async ({ text, images }: { text: string; images: string[] }) => {
      // If images are provided, execute Smart Multi-Photo Intake
      if (images.length > 0) {
        const res = await fetch("/api/ai/smart-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ images, message: text }),
        });
        const respText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(respText);
        } catch {
          throw new Error(
            res.status === 413
              ? "Photos payload is too large. Image optimizer is compressing them."
              : `Server error (${res.status}): ${respText.slice(0, 120)}`
          );
        }
        if (!res.ok || !data.ok) throw new Error(data.error || "Smart Intake failed");
        return {
          type: "smart_intake",
          deal: data.data,
          reply: `Bhaiya, maine saare photos analyze kar liye hain! Phone: ${data.data.brand || ""} ${data.data.model || ""}, IMEI: ${data.data.imei1 || "N/A"}, Price: ₹${data.data.purchase_price || 0}. Kripya neeche verify karke customer ke signature lein aur Confirm dabayein.`,
        };
      }

      // Standard Conversational / Action Agent Chat
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, history: historyPayload }),
      });

      const respText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(respText);
      } catch {
        throw new Error(`Server error (${res.status}): ${respText.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(data.error || "JARVIS failed to process request");
      return {
        type: "chat",
        reply: data.reply,
        toolResults: data.toolResults || [],
        autoSpeak: data.autoSpeak,
      };
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: "msg_" + Date.now(),
        role: "assistant",
        content: data.reply,
        toolResults: data.toolResults || [],
        dealData: data.deal || null,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // System Control Event Dispatches
      if (data.toolResults && Array.isArray(data.toolResults)) {
        for (const tr of data.toolResults) {
          if (tr.action === "NAVIGATE_TAB" && tr.tab) {
            window.dispatchEvent(
              new CustomEvent("phonezone:navigate_tab", { detail: { tab: tr.tab } })
            );
          }
          if (tr.action === "CHANGE_THEME" && tr.theme) {
            window.dispatchEvent(
              new CustomEvent("phonezone:change_theme", { detail: { theme: tr.theme } })
            );
          }
        }
      }

      // Speak reply if autoSpeak or not muted
      if (!isMuted && (data.autoSpeak || isListening)) {
        speakText(data.reply);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "JARVIS communication failed");
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
    if (!query && attachedFiles.length === 0) return;
    if (chatMutation.isPending) return;

    const userMsg: Message = {
      id: "usr_" + Date.now(),
      role: "user",
      content: query || "Attached photos for intake",
      attachedImages: [...attachedFiles],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const sendFiles = [...attachedFiles];
    setInputText("");
    setAttachedFiles([]);

    chatMutation.mutate({ text: query, images: sendFiles });
  };

  // Confirm Smart Intake Deal into Inventory
  const handleConfirmDeal = async (deal: any, msgId: string) => {
    setSavingDealId(msgId);
    try {
      const signature = dealSignatures[msgId] || "";
      const res = await fetch("/api/ai/confirm-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          brand: deal.brand,
          model: deal.model,
          imei1: deal.imei1,
          imei2: deal.imei2,
          purchase_price: deal.purchase_price,
          selling_price: deal.selling_price,
          seller_name: deal.seller_name,
          seller_phone: deal.seller_phone,
          seller_aadhaar: deal.seller_aadhaar,
          seller_address: deal.seller_address,
          seller_signature: signature,
          payment_method: deal.payment_mode || "cash",
          product_photos: deal.product_photos || [],
          purchase_documents: deal.purchase_documents || [],
          payment_proof_photos: deal.payment_proof_photos || [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm deal");

      toast.success(`Deal Locked! ${deal.brand} ${deal.model} added to stock!`, {
        description: `IMEI: ${deal.imei1}. WhatsApp receipt sent.`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["phones"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      // Add success confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: "deal_done_" + Date.now(),
          role: "assistant",
          content: `✅ Mubarak ho! ${deal.brand} ${deal.model} (IMEI: ${deal.imei1}) stock me successfully add ho gaya hai aur legal documents save ho gaye hain.`,
          timestamp: new Date(),
        },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm deal");
    } finally {
      setSavingDealId(null);
    }
  };

  // Open Full Form Pre-filled
  const handleOpenInFullForm = (deal: any) => {
    window.dispatchEvent(
      new CustomEvent("phonezone:prefill_purchase_form", { detail: deal })
    );
    window.dispatchEvent(new CustomEvent("phonezone:open_add_phone"));
    toast.info("Add Phone form pre-filled with AI Vision details!");
  };

  // Preview Bill Action
  const handlePreviewBill = async (sale: any) => {
    try {
      const { buildInvoiceHtml } = await import("@/lib/invoiceTemplates");
      const { printHtml } = await import("@/lib/printHtml");
      const html = buildInvoiceHtml({
        type: "sale",
        sale,
        phone: {
          brand: sale.brand,
          model: sale.model,
          imei_number: sale.imei,
        },
        customer: {
          name: sale.customer_name,
          phone: sale.customer_phone,
        },
      });
      printHtml(html);
    } catch (e) {
      toast.error("Could not preview invoice. Please check sale details.");
    }
  };

  // Download Bill Action
  const handleDownloadBill = (sale: any) => {
    handlePreviewBill(sale);
  };

  // WhatsApp Bill Action
  const handleSendWhatsAppBill = async (sale: any) => {
    try {
      const cleanPhone = (sale.customer_phone || "").replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        toast.error("Valid customer mobile number required for WhatsApp bill.");
        return;
      }

      toast.loading("Sending WhatsApp bill...", { id: "wa-bill" });
      const { buildInvoiceHtml } = await import("@/lib/invoiceTemplates");
      const { dispatchWhatsApp } = await import("@/utils/whatsappDispatcher");
      const html = buildInvoiceHtml({
        type: "sale",
        sale,
        phone: {
          brand: sale.brand,
          model: sale.model,
          imei_number: sale.imei,
        },
        customer: {
          name: sale.customer_name,
          phone: sale.customer_phone,
        },
      });

      await dispatchWhatsApp({
        phone: cleanPhone,
        message: `Namaste ${sale.customer_name || "Customer"} ji, PhoneZone se aapke phone (${sale.brand} ${sale.model}) ki purchase invoice ready hai. Total: ₹${Number(sale.sale_price).toLocaleString()}. Dhanyawad!`,
        invoiceHtml: html,
        pdfFileName: `Invoice_${sale.id}.pdf`,
      });

      toast.success("WhatsApp bill dispatched successfully!", { id: "wa-bill" });
    } catch (e: any) {
      toast.error(e.message || "Failed to send WhatsApp bill", { id: "wa-bill" });
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
        <div className="fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[440px] max-h-[88vh] h-[620px] bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 px-4 flex items-center justify-between border-b border-indigo-800/50 shadow-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-indigo-600/80 border border-indigo-400/50 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-sky-300 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5 leading-tight">
                  JARVIS Copilot
                  <Badge className="text-[9px] py-0 px-1.5 bg-indigo-500/40 text-indigo-200 border-indigo-400/30">
                    {aiConfig?.provider ? aiConfig.provider.toUpperCase() : "AI ONLINE"}
                  </Badge>
                </h3>
                <p className="text-[10px] text-indigo-200/80">Voice • OCR Vision • Store Automation</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Mute / Unmute Toggle */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-1.5 rounded-lg transition-colors ${
                  isMuted ? "text-amber-400 bg-amber-950/40" : "text-indigo-300 hover:text-white hover:bg-white/10"
                }`}
                title={isMuted ? "Audio Muted (Click to Unmute)" : "Audio Active (Click to Mute)"}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {/* Voice Picker Toggle */}
              <button
                type="button"
                onClick={() => setShowVoicePicker((prev) => !prev)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showVoicePicker ? "bg-indigo-600 text-white" : "text-indigo-300 hover:text-white hover:bg-white/10"
                }`}
                title="Select Indian Voice"
              >
                <Sparkles className="h-4 w-4" />
              </button>

              {/* Close Panel */}
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Minimize"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Voice Selector Bar (Collapsible) */}
          {showVoicePicker && (
            <div className="bg-slate-900 border-b border-indigo-900/60 p-2.5 px-3 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-sky-400 flex items-center gap-1">
                  🎙️ AI Indian Voice:
                </span>
                <span className="text-[10px] text-slate-400">Natural 1.15x Cadence</span>
              </div>
              <select
                value={selectedVoiceURI}
                onChange={(e) => {
                  const uri = e.target.value;
                  setSelectedVoiceURI(uri);
                  localStorage.setItem("jarvis_preferred_voice", uri);
                  const chosen = voices.find((v) => v.voiceURI === uri);
                  if (chosen) {
                    const u = new SpeechSynthesisUtterance("Namaste bhaiya, PhoneZone AI online hai.");
                    u.voice = chosen;
                    u.lang = chosen.lang;
                    u.rate = 1.15;
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  }
                }}
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

          {/* Quick Action Suggestion Chips */}
          <div className="p-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => handleSendMessage("Realme phone ki invoice dikhao")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              🧾 Realme Bill?
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Aaj kitni bikri aur munafa hua?")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              📊 Aaj ki bikri?
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Stock me kaunse phones hain?")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              📱 Stock phones?
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Frosted glass theme activate karo")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 transition-colors"
            >
              🎨 Frosted Theme
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
                  className={`max-w-[92%] rounded-2xl p-3 text-xs shadow-xs ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-bl-none"
                  }`}
                >
                  {/* User attached photos preview */}
                  {m.attachedImages && m.attachedImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.attachedImages.map((b64, idx) => (
                        <img
                          key={idx}
                          src={b64}
                          alt="attached"
                          className="h-14 w-14 object-cover rounded-md border border-white/20"
                        />
                      ))}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

                  {/* Tool execution badge */}
                  {m.toolResults && m.toolResults.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                      {m.toolResults.map((tr: any, idx: number) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-1 px-2 rounded font-mono">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span>Action: {tr.toolName} executed</span>
                          </div>

                          {/* Interactive Invoice Card when search_sales returns records */}
                          {tr.toolName === "search_sales" &&
                            tr.result?.records &&
                            tr.result.records.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {tr.result.records.map((sale: any) => (
                                  <div
                                    key={sale.id}
                                    className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-800 dark:text-slate-200"
                                  >
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="flex items-center gap-1">
                                        🧾 Bill #{sale.id.slice(-6)}: {sale.brand} {sale.model}
                                      </span>
                                      <span className="text-emerald-600 font-extrabold">
                                        ₹{Number(sale.sale_price).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-0.5">
                                      <div>
                                        Customer: <b>{sale.customer_name}</b> ({sale.customer_phone})
                                      </div>
                                      <div>
                                        IMEI: <span className="font-mono">{sale.imei}</span> • Mode:{" "}
                                        {sale.payment_mode?.toUpperCase()}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2.5 text-[11px] gap-1"
                                        onClick={() => handlePreviewBill(sale)}
                                      >
                                        <Eye className="h-3 w-3" /> Preview Bill
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2.5 text-[11px] gap-1"
                                        onClick={() => handleDownloadBill(sale)}
                                      >
                                        <Download className="h-3 w-3" /> Download PDF
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={() => handleSendWhatsAppBill(sale)}
                                      >
                                        <Send className="h-3 w-3" /> Send WhatsApp
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Smart Multi-Photo Intake Deal Card */}
                  {m.dealData && (
                    <div className="mt-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-800/60 pb-1.5">
                        <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                          📋 Quick Deal Verification &amp; Entry
                        </span>
                        <Badge className="bg-indigo-600 text-white text-[10px]">
                          AI Vision Verified
                        </Badge>
                      </div>

                      {/* Phone Specs */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500">Phone:</span>{" "}
                          <b>
                            {m.dealData.brand} {m.dealData.model}
                          </b>
                        </div>
                        <div>
                          <span className="text-slate-500">Purchase Price:</span>{" "}
                          <b className="text-emerald-600">
                            ₹{Number(m.dealData.purchase_price || 0).toLocaleString()} (
                            {m.dealData.payment_mode?.toUpperCase() || "CASH"})
                          </b>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500">IMEI 1:</span>{" "}
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {m.dealData.imei1 || "Not detected"}
                          </span>
                          {m.dealData.imei2 && (
                            <span className="text-slate-500 ml-2 font-mono">
                              (IMEI 2: {m.dealData.imei2})
                            </span>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500">Seller:</span>{" "}
                          <b>{m.dealData.seller_name || "Customer"}</b> (
                          {m.dealData.seller_phone || "No phone"})
                          {m.dealData.seller_aadhaar && (
                            <span className="ml-2 text-indigo-600">
                              • Aadhaar: {m.dealData.seller_aadhaar}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Photo Buckets Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-1">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                          📦 Product: {m.dealData.product_photos?.length || 0} pics
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                          🪪 Aadhaar/Docs: {m.dealData.purchase_documents?.length || 0} docs
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">
                          💳 Payment Proof: {m.dealData.payment_proof_photos?.length || 0} pics
                        </span>
                      </div>

                      {/* 3 Signature Options (Draw, Upload, Saved/Mobile) */}
                      <SignatureSelector
                        dealId={m.id}
                        savedSignature={m.dealData.saved_signature}
                        onSave={(sigDataUrl) => {
                          setDealSignatures((prev) => ({ ...prev, [m.id]: sigDataUrl }));
                        }}
                        onClear={() => {
                          setDealSignatures((prev) => {
                            const copy = { ...prev };
                            delete copy[m.id];
                            return copy;
                          });
                        }}
                      />

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-indigo-200 dark:border-indigo-800/60">
                        <Button
                          size="sm"
                          disabled={savingDealId === m.id}
                          className="flex-1 h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                          onClick={() => handleConfirmDeal(m.dealData, m.id)}
                        >
                          {savingDealId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Confirm &amp; Stock Entry</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 gap-1"
                          onClick={() => handleOpenInFullForm(m.dealData)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open in Full Form</span>
                        </Button>
                      </div>
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

          {/* Prominent Instant Stop Speaking Banner */}
          {isSpeaking && (
            <div className="p-2 bg-rose-50 dark:bg-rose-950/70 border-t border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-in fade-in shrink-0">
              <span className="flex items-center gap-1.5 font-semibold">
                <Volume2 className="h-4 w-4 animate-bounce text-rose-600" />
                JARVIS bol raha hai...
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={stopSpeaking}
                className="h-7 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center gap-1 shadow-sm"
              >
                <VolumeX className="h-3.5 w-3.5" /> ⏹️ Chup Karein (Stop)
              </Button>
            </div>
          )}

          {/* Attached Files Preview Bar */}
          {attachedFiles.length > 0 && (
            <div className="p-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
              {attachedFiles.map((b64, idx) => (
                <div key={idx} className="relative group shrink-0">
                  <img
                    src={b64}
                    alt="preview"
                    className="h-12 w-12 object-cover rounded-md border border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachedImage(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                {attachedFiles.length} photo(s) attached
              </span>
            </div>
          )}

          {/* Input & Mic Bar */}
          <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              {/* Hidden file input for photos */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Photo attachment button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full shrink-0 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Attach phone box, Aadhaar, payment photos"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              {/* Mic button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!recognitionRef.current) {
                    toast.error("Speech recognition not supported in this browser. Use Chrome.");
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
                    } catch {
                      recognitionRef.current.stop();
                      setIsListening(false);
                    }
                  }
                }}
                className={`h-9 w-9 rounded-full shrink-0 transition-colors ${
                  isListening
                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse"
                    : "hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                }`}
                title={isListening ? "Listening... Click to stop" : "Click to speak voice command"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              {/* Text Input */}
              <Input
                placeholder={
                  attachedFiles.length > 0
                    ? "Details type karein (e.g. 12000 cash 9876543210)..."
                    : isListening
                    ? "Sun raha hoon... Boliye!"
                    : "Bolkar ya type karke puchein..."
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="text-xs h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex-1"
              />

              {/* Send Button */}
              <Button
                type="submit"
                size="icon"
                disabled={(!inputText.trim() && attachedFiles.length === 0) || chatMutation.isPending}
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
