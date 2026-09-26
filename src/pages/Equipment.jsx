import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Plus, History, Settings, Pencil, Trash2, Bell, BellRing, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { usePreviewRole } from "@/lib/previewRoleContext";
import WarehouseItemForm from "@/components/equipment/WarehouseItemForm";
import WithdrawalForm from "@/components/equipment/WithdrawalForm";
import WithdrawalHistory from "@/components/equipment/WithdrawalHistory";
import EquipmentHoldingsInline from "@/components/equipment/EquipmentHoldingsInline";
import { useToast } from "@/components/ui/use-toast";
import EquipmentSettingsDialog from "@/components/equipment/EquipmentSettingsDialog";
import PendingWithdrawals from "@/components/equipment/PendingWithdrawals";
import MyWithdrawalRequests from "@/components/equipment/MyWithdrawalRequests";
import ReturnConfirmDialog from "@/components/equipment/ReturnConfirmDialog";
import { WAREHOUSES } from "@/lib/constants";
import { hasPermission, effectivePermissions } from "@/lib/permissions";

export default function Equipment() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const { previewRole, previewPluga } = usePreviewRole();
  const [settings, setSettings] = useState(null);
  const [items, setItems] = useState([]);
  const [myPermissions, setMyPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeWarehouse, setActiveWarehouse] = useState(WAREHOUSES[0]);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [holdings, setHoldings] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnSaving, setReturnSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [settingsData, itemsData, holdingsData] = await Promise.all([
      base44.entities.EquipmentSettings.list(),
      base44.entities.WarehouseItem.list(),
      base44.entities.EquipmentHolding.list("-created_date", 100),
    ]);
    setSettings(settingsData[0] || null);
    setItems(itemsData);
    setHoldings(holdingsData);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // "אחראי משיכות ציוד" used to be its own profiles.equipment_manager flag;
  // it's now the equipment_manager delegated permission instead (see
  // src/lib/permissions.js), granted the same way as every other permission
  // in AdminPanel's "הרשאות מיוחדות" section.
  useEffect(() => {
    if (!user?.id) return;
    base44.entities.UserPermission.filter({ user_id: user.id })
      .then(setMyPermissions)
      .catch(() => setMyPermissions([]))
      .finally(() => setPermissionsLoading(false));
  }, [user?.id]);

  const effectiveRole = previewRole || user?.role;
  const effectivePluga = previewRole === "קלפ" ? previewPluga : user?.pluga;
  const isAdmin = effectiveRole === "admin";
  const isKlaf = effectiveRole === "קלפ";
  const isResponsible = settings?.responsible_klaf_id === user?.id;
  // effectivePermissions needs the user's REAL role (never a previewed one)
  // so admin-preview never hands a previewed role an admin's permissions.
  const myEffectivePermissions = effectivePermissions(myPermissions, user?.role);
  const isEquipmentManager = hasPermission(myEffectivePermissions, "equipment_manager");
  const canEdit = isAdmin || isResponsible || isEquipmentManager;
  const canAddItem = canEdit || isKlaf;
  // Who's allowed to set an item's target quantity (used to detect a
  // shortage at withdrawal time and suggest a Playbox completion order) —
  // specifically playbox_orders or equipment_manager, per the feature
  // request, not the broader canEdit (which also includes isResponsible,
  // a separate legacy per-item mechanism unrelated to either permission).
  const canSetTargets = isAdmin || isEquipmentManager || hasPermission(myEffectivePermissions, "playbox_orders");

  if (!user || loading || permissionsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (effectiveRole !== "admin" && effectiveRole !== "קלפ") {
    return (
      <div className="text-center py-20 text-muted-foreground">דף זה אינו זמין עבורך</div>
    );
  }

  const warehouseItems = items.filter((i) => i.warehouse === activeWarehouse);

  const handleItemSubmit = async (data) => {
    if (editingItem) {
      await base44.entities.WarehouseItem.update(editingItem.id, data);
    } else {
      await base44.entities.WarehouseItem.create(data);
    }
    await loadData();
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("למחוק את הפריט?")) return;
    await base44.entities.WarehouseItem.delete(id);
    await loadData();
  };

  const handleSettingsSave = async (data) => {
    if (settings) {
      const updated = await base44.entities.EquipmentSettings.update(settings.id, data);
      setSettings(updated);
    } else {
      const created = await base44.entities.EquipmentSettings.create(data);
      setSettings(created);
    }
  };

  const handleReturn = (holding) => {
    setReturnTarget(holding);
  };

  const handleConfirmReturn = async () => {
    if (!returnTarget) return;
    setReturnSaving(true);
    try {
      const wi = items.find((i) => i.warehouse === returnTarget.warehouse && i.name === returnTarget.item_name);
      if (wi) {
        await base44.entities.WarehouseItem.update(wi.id, { quantity: wi.quantity + returnTarget.quantity });
      }
      await base44.entities.EquipmentHolding.delete(returnTarget.id);
      await loadData();
      setReturnTarget(null);
    } catch (err) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setReturnSaving(false);
    }
  };

  const isSubscribed = (settings?.notification_emails || []).includes(user?.email);

  const exportAllToExcel = async () => {
    const [allWithdrawals, allHoldings] = await Promise.all([
      base44.entities.WithdrawalRequest.list("-created_date", 500),
      base44.entities.EquipmentHolding.list("-created_date", 500),
    ]);
    const wb = XLSX.utils.book_new();

    const holdingsData = allHoldings.map((h) => ({
      "פריט": h.item_name || "",
      "כמות": h.quantity || "",
      "מחסן": h.warehouse || "",
      "פלוגה": h.pluga || "",
      "מחזיק": h.held_by_name || "",
      "תאריך משיכה": h.withdrawal_date || "",
      "תאריך החזרה צפוי": h.expected_return_date || "",
    }));
    const wsH = XLSX.utils.json_to_sheet(holdingsData);
    wsH["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsH, "ציוד מחוץ למחסן");

    const STATUS_LABELS = { pending: "ממתין לאישור", approved: "מאושר", rejected: "נדחה" };
    const withdrawalsData = allWithdrawals.map((w) => ({
      "מבקש": w.requested_by_name || "",
      "פלוגה": w.pluga || "",
      "מחסן": w.warehouse || "",
      "תאריך בקשה": w.request_date || "",
      "תאריך החזרה צפוי": w.expected_return_date || "",
      "סטטוס": STATUS_LABELS[w.status] || w.status || "",
      "מאשר": w.approved_by_name || "",
      "פריטים": (w.items || []).map((i) => `${i.name} ×${i.quantity}${i.returnable ? " (להחזרה)" : ""}`).join(", "),
      "הערות": w.notes || "",
    }));
    const wsW = XLSX.utils.json_to_sheet(withdrawalsData);
    wsW["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsW, "משיכות ציוד");

    XLSX.writeFile(wb, "דוח_משיכות_ציוד.xlsx");
  };

  const handleToggleNotifications = async () => {
    const currentEmails = settings?.notification_emails || [];
    const newEmails = isSubscribed
      ? currentEmails.filter((e) => e !== user.email)
      : [...currentEmails, user.email];
    try {
      if (settings) {
        const updated = await base44.entities.EquipmentSettings.update(settings.id, {
          notification_emails: newEmails,
        });
        setSettings(updated);
      } else {
        const created = await base44.entities.EquipmentSettings.create({
          notification_emails: newEmails,
        });
        setSettings(created);
      }
      toast({
        title: isSubscribed ? "התראות הופסקו" : "התראות הופעלו",
        description: isSubscribed
          ? "לא תקבל עוד אימיילים על משיכות"
          : "תקבל אימייל על כל משיכת ציוד",
      });
    } catch (err) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">משיכות ציוד</h1>
            <p className="text-xs text-muted-foreground">ניהול מלאי ומשיכת ציוד</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button size="sm" onClick={() => setWithdrawalOpen(true)} className="gap-1">
            <Package className="w-4 h-4" /> משיכה חדשה
          </Button>
          <Button variant="outline" size="sm" onClick={exportAllToExcel} className="gap-1">
            <Download className="w-4 h-4" /> ייצוא לאקסל
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-1">
              <History className="w-4 h-4" /> היסטוריה
            </Button>
          )}
          {canEdit && user?.email && (
            <Button
              variant={isSubscribed ? "default" : "outline"}
              size="sm"
              onClick={handleToggleNotifications}
              className="gap-1"
            >
              {isSubscribed ? (
                <><BellRing className="w-4 h-4" /> התראות פעילות</>
              ) : (
                <><Bell className="w-4 h-4" /> הפעל התראות</>
              )}
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} title="הגדרות">
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {canEdit && <PendingWithdrawals onDecision={loadData} />}

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {WAREHOUSES.map((w) => (
          <button
            key={w}
            onClick={() => setActiveWarehouse(w)}
            className={cn(
              "flex-1 px-2 py-2 text-sm rounded-md transition-colors text-center",
              activeWarehouse === w ? "bg-white shadow-sm font-medium" : "text-muted-foreground"
            )}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            פריטים במחסן ({warehouseItems.length})
          </h2>
          {canAddItem && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingItem(null);
                setItemFormOpen(true);
              }}
              className="gap-1"
            >
              <Plus className="w-4 h-4" /> הוסף פריט
            </Button>
          )}
        </div>
        {warehouseItems.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border border-border rounded-xl bg-white">
            <p className="text-sm">אין פריטים במחסן זה</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pl-1">
            {warehouseItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-white border border-border rounded-lg p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    כמות: {item.quantity}
                    {Number(item.target_quantity) > 0 && ` · יעד: ${item.target_quantity}`}
                  </p>
                </div>
                {Number(item.target_quantity) > 0 && Number(item.quantity) < Number(item.target_quantity) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    חסר {Number(item.target_quantity) - Number(item.quantity)}
                  </span>
                )}
                {item.returnable && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    להחזרה
                  </span>
                )}
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setItemFormOpen(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <EquipmentHoldingsInline holdings={holdings} canEdit={canEdit} onReturn={handleReturn} />

      {!canEdit && <MyWithdrawalRequests user={user} />}

      <WarehouseItemForm
        open={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        onSubmit={handleItemSubmit}
        warehouse={activeWarehouse}
        editingItem={editingItem}
        canSetTarget={canSetTargets}
      />
      <WithdrawalForm
        open={withdrawalOpen}
        onClose={() => setWithdrawalOpen(false)}
        warehouse={activeWarehouse}
        items={warehouseItems}
        userPluga={effectivePluga}
        onDone={loadData}
      />
      {canEdit && (
        <WithdrawalHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
      )}
      {isAdmin && (
        <EquipmentSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSave={handleSettingsSave}
        />
      )}
      <ReturnConfirmDialog
        target={returnTarget}
        onClose={() => setReturnTarget(null)}
        onConfirm={handleConfirmReturn}
        saving={returnSaving}
      />
    </div>
  );
}