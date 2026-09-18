import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, Check, X, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending: { label: "ממתינה לאישור", icon: Clock, className: "bg-amber-100 text-amber-700", borderClass: "border-amber-200" },
  approved: { label: "אושרה", icon: Check, className: "bg-green-100 text-green-700", borderClass: "border-green-200" },
  rejected: { label: "נדחתה", icon: X, className: "bg-red-100 text-red-700", borderClass: "border-red-200" },
};

export default function MyWithdrawalRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await base44.entities.WithdrawalRequest.filter(
        { created_by_id: user.id },
        "-created_date",
        10
      );
      setRequests(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.WithdrawalRequest.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  if (loading || requests.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          הבקשות שלי ({requests.length})
        </h2>
      </div>
      <div className="space-y-2">
        {requests.map((r) => {
          const config = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
          const StatusIcon = config.icon;
          return (
            <div key={r.id} className={cn("bg-white border rounded-lg p-3 space-y-2", config.borderClass)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.warehouse}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.request_date}
                    {r.expected_return_date ? ` · החזרה: ${r.expected_return_date}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium shrink-0 flex items-center gap-1",
                    config.className
                  )}
                >
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.items.map((item, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded-md bg-slate-100">
                    {item.name} ×{item.quantity}
                    {item.returnable ? " · להחזרה" : ""}
                  </span>
                ))}
              </div>
              {r.status === "approved" && r.approved_by_name && (
                <p className="text-xs text-green-600">אושר ע"י {r.approved_by_name}</p>
              )}
              {r.status === "rejected" && r.approved_by_name && (
                <p className="text-xs text-red-600">נדחה ע"י {r.approved_by_name}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}