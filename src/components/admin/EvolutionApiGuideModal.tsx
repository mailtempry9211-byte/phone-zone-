import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, CheckCircle2, ShieldCheck, Zap, Sparkles, Server, QrCode, Globe } from "lucide-react";
import { toast } from "sonner";

interface EvolutionApiGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EvolutionApiGuideModal: React.FC<EvolutionApiGuideModalProps> = ({ open, onOpenChange }) => {
  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-white dark:bg-[#0c1322] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Evolution API / WPPConnect — शुरुआती गाइड (Noob Guide)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                100% Free Lifetime WhatsApp Gateway • Standalone Mobile APK &amp; PC दोनों पर काम करता है
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-xs mt-2">
          {/* Why this is the best for Mobile */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
              यह क्या है और मोबाइल APK के लिए सबसे बेस्ट क्यों है?
            </div>
            <p className="text-emerald-800 dark:text-emerald-400 leading-relaxed text-[11px]">
              पुराने OpenWA में कंप्यूटर पर भारी Chrome ब्राउज़र चलता था जो मोबाइल में नहीं चल सकता। 
              लेकिन <strong>Evolution API / WPPConnect</strong> क्लाउड में चलता है। आपका मोबाइल सिर्फ 1 सेकंड में मैसेज और PDF इनवॉइस भेज देता है — 
              <strong> 0% बैटरी खर्च, 0% हैंग, और बिल्कुल मुफ़्त (₹0 खर्चा)</strong>!
            </p>
          </div>

          {/* STEP 1 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                स्टेप 1: मुफ़्त सर्वर चालू करना (Render.com या Koyeb.com पर)
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-300">
                100% Free
              </Badge>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px]">
              1. <strong>Render.com</strong> या <strong>Koyeb.com</strong> पर फ़्री अकाउंट बनाएँ।<br />
              2. <strong>New Web Service &rarr; Existing Image (Docker)</strong> चुनें।<br />
              3. Image URL में यह पेस्ट करें:
            </p>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px]">
              <span>atendai/evolution-api:v2.1.1</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-slate-300 hover:text-white"
                onClick={() => copyText("atendai/evolution-api:v2.1.1", "Docker Image")}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px]">
              4. <strong>Environment Variables</strong> में सिर्फ 2 चीज़ें डालें:
            </p>
            <ul className="list-disc list-inside space-y-1 font-mono text-[10px] text-slate-700 dark:text-slate-300 pl-1">
              <li>AUTHENTICATION_API_KEY = <span className="text-amber-600 dark:text-amber-400">PhoneZone2026MasterKey</span></li>
              <li>SERVER_URL = <span className="text-blue-600 dark:text-blue-400">https://your-service-name.onrender.com</span></li>
            </ul>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              5. <strong>Deploy</strong> बटन दबाएँ। 3 मिनट में आपका सर्वर ऑनलाइन हो जाएगा और आपको एक URL मिलेगी (जैसे <code>https://my-evo.onrender.com</code>).
            </p>
          </div>

          {/* STEP 2 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
              स्टेप 2: WhatsApp लिंक करना (QR Code स्कैन)
            </span>
            <p className="text-slate-600 dark:text-slate-300 text-[11px]">
              1. अपने सर्वर की लिंक ब्राउज़र में खोलें और अपने API Key से लॉगिन करें।<br />
              2. <strong>Create Instance</strong> पर क्लिक करें और नाम रखें: <code>phonezone</code>.<br />
              3. स्क्रीन पर QR Code आएगा। अपने फोन के WhatsApp में जाकर <strong>Linked Devices &rarr; Link a Device</strong> करके स्कैन कर दें।<br />
              4. स्टेटस <strong>Connected (Green)</strong> हो जाएगा!
            </p>
          </div>

          {/* STEP 3 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
              स्टेप 3: PhoneZone Settings में डिटेल्स डालना
            </span>
            <p className="text-slate-600 dark:text-slate-300 text-[11px]">
              PhoneZone ऐप में नीचे दिए गए 3 बॉक्स भरें:
            </p>
            <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px]">
              <div><strong>Evolution API URL:</strong> e.g. <code>https://my-evo.onrender.com</code></div>
              <div><strong>API Key:</strong> e.g. <code>PhoneZone2026MasterKey</code></div>
              <div><strong>Instance Name:</strong> e.g. <code>phonezone</code></div>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              उसके बाद <strong>&quot;Save Settings&quot;</strong> और <strong>&quot;Test Connection&quot;</strong> दबाएँ।
            </p>
          </div>

          {/* 24/7 Persistent Note */}
          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-1">
            <div className="font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
              <Globe className="h-4 w-4" />
              24/7 लगातार (Persistent) कैसे रहेगा?
            </div>
            <p className="text-sky-800 dark:text-sky-400 text-[11px] leading-relaxed">
              क्योंकि यह सर्वर Render या Koyeb के क्लाउड पर चलता है, इसलिए यह 24 घंटे लगातार ऑनलाइन रहता है। 
              आपकी दुकान का कंप्यूटर बंद हो या फोन की स्क्रीन बंद हो, यह सर्वर कभी नहीं सोता और हमेशा एक्टिव रहता है!
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
            समझ गया (Close Guide)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvolutionApiGuideModal;
