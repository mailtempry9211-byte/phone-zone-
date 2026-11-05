import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check, PenTool, Upload, FileText, CheckCircle2 } from "lucide-react";

interface SignaturePadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  signerName?: string;
  onSave: (dataUrl: string) => void;
  initialSignature?: string | null;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  open,
  onOpenChange,
  title = "Seller Digital Signature (विक्रेता के डिजिटल हस्ताक्षर)",
  signerName = "",
  onSave,
  initialSignature = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTab, setActiveTab] = useState<"draw" | "upload" | "saved">("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);

  // Resize canvas for high-DPI displays on open
  useEffect(() => {
    if (!open) return;
    if (activeTab !== "draw") return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw baseline guideline
      drawBackground(ctx, rect.width, rect.height);
      setHasDrawn(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [open, activeTab]);

  const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Subtle signature guide line at 75% height
    ctx.save();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, h * 0.75);
    ctx.lineTo(w - 30, h * 0.75);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("Sign above the line (यहाँ हस्ताक्षर करें)", 32, h * 0.75 + 18);
    ctx.restore();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawBackground(ctx, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedSignature(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (activeTab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const dataUrl = canvas.toDataURL("image/png");
      onSave(dataUrl);
      onOpenChange(false);
    } else if (activeTab === "upload" && uploadedSignature) {
      onSave(uploadedSignature);
      onOpenChange(false);
    } else if (activeTab === "saved" && initialSignature) {
      onSave(initialSignature);
      onOpenChange(false);
    }
  };

  const canSave =
    (activeTab === "draw" && hasDrawn) ||
    (activeTab === "upload" && !!uploadedSignature) ||
    (activeTab === "saved" && !!initialSignature);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg p-4 sm:p-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
            <PenTool className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            {signerName ? (
              <span>Signer: <strong>{signerName}</strong>. Choose one of the 3 signature options below.</span>
            ) : (
              <span>Neeche diye 3 tareeqo me se kisi bhi ek tareeqe se signature jodein.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* 3 Signature Options Navigation Pills */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "draw"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>1. Draw</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "upload"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>2. Upload</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "saved"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>3. Saved</span>
          </button>
        </div>

        {/* Tab 1: Draw on Canvas */}
        {activeTab === "draw" && (
          <div className="space-y-3">
            <div className="border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-inner bg-white touch-none">
              <canvas
                ref={canvasRef}
                className="w-full h-56 cursor-crosshair block"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400">Mobile screen ya mouse se sign karein</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Clear (मिटाएं)
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Upload File / Photo */}
        {activeTab === "upload" && (
          <div className="space-y-3">
            {uploadedSignature ? (
              <div className="border-2 border-slate-300 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
                <div className="h-36 w-full max-w-xs bg-white rounded p-2 flex items-center justify-center border border-slate-200">
                  <img src={uploadedSignature} alt="Uploaded Signature" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <Button type="button" variant="outline" size="sm" asChild className="h-7 text-xs">
                      <span>Change Photo</span>
                    </Button>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadedSignature(null)}
                    className="h-7 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900/60 transition-colors">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Kagaz par bane dastakhat ki photo chunein</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, JPEG (Camera se click karein ya gallery se chunein)</p>
              </label>
            )}
          </div>
        )}

        {/* Tab 3: Use Saved Signature */}
        {activeTab === "saved" && (
          <div className="space-y-3">
            {initialSignature ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/60 flex flex-col items-center justify-center gap-3">
                <div className="h-32 w-full max-w-xs bg-white rounded p-2 flex items-center justify-center border border-slate-200 shadow-xs">
                  <img src={initialSignature} alt="Saved Seller Signature" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Is seller ke purane dastakhat database me uplabdh hain</span>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-900/40">
                <FileText className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Is seller ka koi purana dastakhat save nahi hai</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kripya Tab 1 (Draw) ya Tab 2 (Upload) se naya signature jodein</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Apply Signature (हस्ताक्षर जोड़ें)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignaturePadModal;

