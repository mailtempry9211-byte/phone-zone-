import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, ShieldAlert, HelpCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
  onPasswordResetSuccess?: (email: string) => void;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  open,
  onOpenChange,
  initialEmail = "",
  onPasswordResetSuccess,
}) => {
  const [tab, setTab] = useState<"question" | "master">("question");

  // Step 1: Query question
  const [email, setEmail] = useState(initialEmail);
  const [isFetchingQuestion, setIsFetchingQuestion] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);

  // Step 2: Answer & New Password
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Auto-fill initial email when dialog opens
  React.useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) {
      toast.error("Please enter your login username or email");
      return;
    }

    setIsFetchingQuestion(true);
    try {
      const res = await fetch("/api/auth/recovery/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to find account security question");
      }
      setQuestion(data.question);
      toast.success("Security question found. Please enter your answer.");
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch question");
    } finally {
      setIsFetchingQuestion(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) {
      toast.error("Please enter the security answer");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/auth/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          answer: answer.trim(),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      toast.success(data.message || "Password updated successfully!");
      if (onPasswordResetSuccess) {
        onPasswordResetSuccess(email.trim().toLowerCase());
      }
      onOpenChange(false);
      // Reset state
      setQuestion(null);
      setAnswer("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Password reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#0c1322] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <KeyRound className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Password Recovery & Reset
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Recover your Master Admin or Staff account password safely.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 my-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "question" ? "default" : "outline"}
            className="text-xs h-7 gap-1"
            onClick={() => setTab("question")}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Security Question
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "master" ? "default" : "outline"}
            className="text-xs h-7 gap-1 text-amber-700 dark:text-amber-300 border-amber-300/40"
            onClick={() => setTab("master")}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            Master Rescue Code
          </Button>
        </div>

        {tab === "question" ? (
          <div className="space-y-4 py-1">
            {!question ? (
              <form onSubmit={handleFetchQuestion} className="space-y-3">
                <div>
                  <Label htmlFor="recoveryEmail" className="text-xs font-semibold">
                    Enter Login Username or Email
                  </Label>
                  <Input
                    id="recoveryEmail"
                    placeholder="e.g. mailtempry@gmail.com or admin"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    System will find your pre-configured security question.
                  </p>
                </div>
                <Button type="submit" className="w-full text-xs h-9" disabled={isFetchingQuestion}>
                  {isFetchingQuestion ? "Searching..." : "Find Security Question"}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50">
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                    Security Question for ({email}):
                  </div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">
                    {question}
                  </div>
                </div>

                <div>
                  <Label htmlFor="secAnswer" className="text-xs font-semibold">
                    Your Secret Answer *
                  </Label>
                  <Input
                    id="secAnswer"
                    placeholder="Enter the answer you set during setup"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="secNewPass" className="text-xs font-semibold">
                    New Password * (Min 6 chars)
                  </Label>
                  <Input
                    id="secNewPass"
                    type="password"
                    placeholder="Enter new strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="secConfPass" className="text-xs font-semibold">
                    Confirm New Password *
                  </Label>
                  <Input
                    id="secConfPass"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-1/3 text-xs h-9"
                    onClick={() => {
                      setQuestion(null);
                      setAnswer("");
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="w-2/3 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isResetting}
                  >
                    {isResetting ? "Updating..." : "Reset Password"}
                    <CheckCircle2 className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-1 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-slate-800 dark:text-slate-200 space-y-2">
              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                <ShieldAlert className="h-4 w-4" />
                Master Admin Emergency Override Login:
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                Agar aap apna security question bhi bhool gaye hain, toh aap login screen par <strong>Master Emergency Rescue Key</strong> use karke direct login kar sakte hain:
              </p>
              
              <div className="space-y-1.5 pt-1">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border font-mono text-[11px]">
                  <span className="text-gray-500">Formula 1 (Static):</span>
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    [Primary Phone Number] + 9211921192119211
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border font-mono text-[11px]">
                  <span className="text-gray-500">Formula 2 (Date-Based *9211):</span>
                  <div className="font-bold text-sky-700 dark:text-sky-400">
                    [Primary Phone]*9211*[Today&apos;s Date DDMM]
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground pt-1">
                📌 Login screen par Password field me yeh enter karein. Login hone ke baad turant Settings me jaakar naya password set kar lein.
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full text-xs h-8"
              onClick={() => onOpenChange(false)}
            >
              Back to Login Screen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
