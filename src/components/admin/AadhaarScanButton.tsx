/**
 * AadhaarScanButton - drop-in "Scan Front / Scan Back" control for
 * seller/customer forms.
 *
 * Pick a photo (or take one with the camera on mobile), OCR it fully offline,
 * then hand the parsed fields to the form via onResult. The button never
 * uploads anywhere - recognition happens in the browser. The scanned photo
 * itself is handed to the form via onPhoto (if provided) so the phone form can
 * file it under Purchase Documents - no double work for the user.
 *
 * Front side carries the name / DOB / gender / mobile, the back side the
 * address - fillPersonFields merges them, so scan front first, then back.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAadhaarOcr } from "@/hooks/useAadhaarOcr";
import type { AadhaarData } from "@/lib/aadhaarParser";

export type AadhaarSide = "front" | "back";

interface AadhaarScanButtonProps {
  onResult: (data: AadhaarData) => void;
  /** Called once per successful scan with the photo the user took/picked. */
  onPhoto?: (file: File, side: AadhaarSide) => void;
  disabled?: boolean;
}

const AadhaarScanButton = ({ onResult, onPhoto, disabled }: AadhaarScanButtonProps) => {
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const { status, progress, data, error, scan, reset, viaQr } = useAadhaarOcr();
  const [justFilled, setJustFilled] = useState<AadhaarSide | null>(null);
  const [scannedSide, setScannedSide] = useState<AadhaarSide | null>(null);

  const busy = status === "loading" || status === "reading";

  // Push the parsed result + photo to the form exactly once per successful scan.
  // Use a scan-counter ref (not idNumber) so back-side scans (no number = "")
  // still fire onResult even after a front-side scan already set lastId to "".
  const scanCounterRef = useRef(0);
  const lastFiredRef = useRef(-1);
  const photoRef = useRef<{ file: File; side: AadhaarSide } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, side: AadhaarSide) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setJustFilled(null);
    scanCounterRef.current += 1;
    photoRef.current = { file, side };
    setScannedSide(side);
    await scan(file, side);
  };

  useEffect(() => {
    if (status === "done" && data && lastFiredRef.current !== scanCounterRef.current) {
      lastFiredRef.current = scanCounterRef.current;
      onResult(data);
      setJustFilled(scannedSide);
      const shot = photoRef.current;
      if (onPhoto && shot) onPhoto(shot.file, shot.side);
      if (scannedSide === "front") {
        toast.success(
          data.name
            ? `Aadhaar Front: ${data.name} identified! Now click 'Scan Back' for address.`
            : "Aadhaar Front read! Now click 'Scan Back' for address.",
        );
      } else if (scannedSide === "back") {
        toast.success(
          data.address
            ? "Aadhaar Back: Address captured! If name is empty, click 'Scan Front'."
            : "Aadhaar Back read! Please verify the address.",
        );
      } else {
        toast.success(
          viaQr
            ? "Aadhaar read from QR code - details filled in"
            : data.checksumOk
              ? "Aadhaar read - details filled in"
              : "Aadhaar read - please verify number",
        );
      }
    }
  }, [status, data, onResult, onPhoto, scannedSide]);

  const scanButton = (side: AadhaarSide, inputRef: React.RefObject<HTMLInputElement | null>) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || busy}
      onClick={() => inputRef.current?.click()}
      className="flex-1"
    >
      {busy && scannedSide === side ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {status === "loading" ? "Starting OCR..." : `Reading... ${Math.round(progress * 100)}%`}
        </>
      ) : justFilled === side && status === "done" ? (
        <>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {side === "front" ? "Front done" : "Back done"}
        </>
      ) : (
        <>
          <ScanLine className="h-4 w-4 mr-2" />
          {side === "front" ? "Scan Front" : "Scan Back"}
        </>
      )}
    </Button>
  );

  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <div className="flex gap-2">
        {scanButton("front", frontInputRef)}
        {scanButton("back", backInputRef)}
      </div>
      <input
        ref={frontInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e, "front")}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e, "back")}
      />
      {status === "error" && (
        <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}
      {status === "done" && data && (
        <p className="text-xs text-gray-500">
          {[
            scannedSide && `${scannedSide === "front" ? "Front" : "Back"}:`,
            viaQr && "via QR",
            data.name && `Name: ${data.name}`,
            data.dob && `DOB: ${data.dob}`,
            data.gender && `Gender: ${data.gender}`,
            data.mobile && `Mobile: ${data.mobile}`,
            data.address && `Address filled`,
          ]
            .filter(Boolean)
            .join(" ") || "Number only"}
          {!data.checksumOk && " · verify the number"}
        </p>
      )}
    </div>
  );
};

export default AadhaarScanButton;
