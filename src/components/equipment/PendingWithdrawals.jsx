import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Clock } from "lucide-react";
import { PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export default function PendingWithdrawals({ onDecision }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await base44.entities.WithdrawalRequest.filter({ status: "pending" }, "-created_date", 50);
      setRequests(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.WithdrawalRequest.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const handleDecision = async (request, decision) => {
    setProcessing(request.id);
    try {
      await base44.functions.invoke("approveWithdrawal", {
        withdrawal_id: request.id,
        decision,
      });
      toast({
        title: decision === "approved" ? "הבקשה אושרה" : "הבקשה נדחתה",
        duration: 3000,
      });
      await load();
      onDecision?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          בקשות משיכה ממתינות ({requests.length})
        </h2>
      </div>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.requested_by_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.warehouse} · {r.request_date}
                  {r.expected_return_date ? ` · החזרה: ${r.expected_return_date}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium shrink-0",
                  PLUGA_COLORS[r.pluga]?.light || "bg-muted"
                )}
              >
                {r.pluga}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.items.map((item, idx) => (
                <span key={idx} className="text-xs px-2 py-1 rounded-md bg-slate-100">
                  {item.name} ×{item.quantity}
                  {item.returnable ? " · להחזרה" : ""}{item.custom ? " · לא מהמלאי" : ""}
                </span>
              ))}
            </div>
            {r.notes && (
              <p className="text-xs text-muted-foreground bg-muted/60 rounded-md p-2">{r.notes}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => handleDecision(r, "approved")}
                disabled={processing === r.id}
                className="gap-1 flex-1"
              >
                {processing === r.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                אשר
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecision(r, "rejected")}
                disabled={processing === r.id}
                className="gap-1 flex-1"
              >
                <X className="w-3.5 h-3.5" />
                דחה
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}