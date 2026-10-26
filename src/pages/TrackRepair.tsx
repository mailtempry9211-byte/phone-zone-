import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Wrench, Clock, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, PhoneCall } from "lucide-react";

export default function TrackRepair() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("job") || searchParams.get("phone") || "");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const doSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setLoading(true);
    setErrorMsg("");
    setSearched(true);
    setJob(null);

    try {
      const res = await fetch(`/api/public/repair/track?q=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
      } else {
        const b = await res.json().catch(() => ({}));
        setErrorMsg(b.error || "No active repair job found matching that ID or Mobile number.");
      }
    } catch {
      setErrorMsg("Unable to reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get("job") || searchParams.get("phone");
    if (initial) {
      doSearch(initial);
    }
  }, [searchParams]);

  const statusBadge = (st: string) => {
    switch (st) {
      case "received":
        return <Badge className="bg-blue-600">Device Received</Badge>;
      case "diagnosing":
        return <Badge className="bg-amber-600">Diagnosing Issue</Badge>;
      case "waiting_parts":
        return <Badge className="bg-orange-600">Waiting for Spare Parts</Badge>;
      case "in_progress":
        return <Badge className="bg-indigo-600">Repair in Progress</Badge>;
      case "ready":
        return <Badge className="bg-green-600">Ready for Pickup</Badge>;
      case "delivered":
        return <Badge className="bg-slate-700">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{st}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Store
          </Link>
          <span className="text-xs text-gray-500 font-mono">Live Repair Tracking</span>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Wrench className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Track Your Device Repair</CardTitle>
            <CardDescription>
              Enter your Job Sheet Number (e.g. RJ-MAIN-2026-27-0001) or Registered Mobile Number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doSearch(query);
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Job Number or 10-digit Mobile"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-base"
                required
              />
              <Button type="submit" disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Searching..." : "Track"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !loading && errorMsg && (
          <Card className="border-red-200 bg-red-50 text-red-900">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Repair Job Not Found</p>
                <p className="text-xs text-red-700 mt-1">{errorMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {searched && !loading && job && (
          <Card className="border-green-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono">Job No:</span>
                <div className="font-mono font-bold text-base">{job.job_no}</div>
              </div>
              <div>{statusBadge(job.status)}</div>
            </div>

            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Device</span>
                  <span className="font-medium text-slate-800">
                    {job.device_brand || ""} {job.device_model || "Mobile Device"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Customer</span>
                  <span className="font-medium text-slate-800">{job.customer_name || "Valued Client"}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Problem Reported</span>
                  <span className="text-slate-700">{job.problem}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Received On</span>
                  <span className="text-slate-700">
                    {job.received_at ? new Date(job.received_at).toLocaleDateString() : "In Shop"}
                  </span>
                </div>
              </div>

              {job.estimate && (
                <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between text-sm">
                  <span className="text-gray-600">Estimated Cost:</span>
                  <span className="font-bold text-slate-900">₹{job.estimate.toLocaleString()}</span>
                </div>
              )}

              {job.status === "ready" && (
                <div className="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-900 text-xs">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span>
                    Your device has been repaired and successfully passed quality checks. Please bring your Job Sheet receipt for pickup.
                  </span>
                </div>
              )}

              <div className="pt-2 border-t flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> 30-Day Service Warranty
                </span>
                <span className="font-mono">PhoneZone Service Care</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

