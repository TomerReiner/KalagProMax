import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserCog, Check, X, Loader2, Mail, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PLUGOT } from "@/lib/constants";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { cn } from "@/lib/utils";

const ROLES = ["קלפ", "רסר", "סגל", "admin"];

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [roleOverrides, setRoleOverrides] = useState({});
  const [plugaOverrides, setPlugaOverrides] = useState({});
  const [tab, setTab] = useState("requests");
  const [updatingUser, setUpdatingUser] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { previewRole, setPreviewRole, previewPluga, setPreviewPluga } = usePreviewRole();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await base44.entities.AccessRequest.filter({ status: "pending" });
      setRequests(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await base44.entities.User.list();
      setUsers(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    loadRequests();
    loadUsers();
    const unsubscribe = base44.entities.AccessRequest.subscribe(() => loadRequests());
    return unsubscribe;
  }, [user, loadRequests, loadUsers]);

  if (user?.role !== "admin") return null;

  const pendingCount = requests.length;

  const handleApprove = async (request) => {
    const role = roleOverrides[request.id] || "קלפ";
    const pluga = plugaOverrides[request.id] || null;
    setProcessing(request.id);
    setError(null);
    try {
      // inviteUser only accepts "user" or "admin" — invite with platform role, then set custom role
      const platformRole = role === "admin" ? "admin" : "user";
      await base44.users.inviteUser(request.email, platformRole);

      // Wait for the user to appear in the User entity, then set custom role + pluga
      let found = null;
      for (let i = 0; i < 6; i++) {
        const allUsers = await base44.entities.User.list();
        found = allUsers.find((u) => u.email === request.email);
        if (found) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (found) {
        const updateData = { role };
        if (role === "קלפ" && pluga) {
          updateData.pluga = pluga;
        }
        await base44.entities.User.update(found.id, updateData);
      }

      await base44.entities.AccessRequest.update(request.id, {
        status: "approved",
        assigned_role: role,
        pluga: pluga || undefined,
      });
      setRoleOverrides((prev) => { const next = { ...prev }; delete next[request.id]; return next; });
      setPlugaOverrides((prev) => { const next = { ...prev }; delete next[request.id]; return next; });
      await loadRequests();
      await loadUsers();
      toast({ title: "המשתמש אושר והוזמן בהצלחה", duration: 3000 });
    } catch (err) {
      console.error(err);
      setError(err.message || "שגיאה באישור הבקשה");
      toast({ title: "שגיאה באישור הבקשה", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (request) => {
    setProcessing(request.id);
    try {
      await base44.entities.AccessRequest.update(request.id, { status: "denied" });
      await loadRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateUserPluga = async (userId, pluga) => {
    setUpdatingUser(userId);
    try {
      await base44.entities.User.update(userId, { pluga });
      await loadUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleUpdateUserRole = async (userId, role) => {
    setUpdatingUser(userId);
    try {
      await base44.entities.User.update(userId, { role });
      await loadUsers();
      toast({ title: "התפקיד עודכן בהצלחה", duration: 3000 });
    } catch (err) {
      console.error(err);
      toast({ title: "שגיאה בעדכון התפקיד", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleToggleEquipmentManager = async (userId, value) => {
    setUpdatingUser(userId);
    try {
      await base44.entities.User.update(userId, { equipment_manager: value });
      await loadUsers();
      toast({ title: value ? "סומן כאחראי משיכות ציוד" : "הוסר מאחראי משיכות ציוד", duration: 3000 });
    } catch (err) {
      console.error(err);
      toast({ title: "שגיאה בעדכון", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingUser(null);
    }
  };

  const currentRole = (id) => roleOverrides[id] || "קלפ";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
          title="ניהול משתמשים ובקשות גישה"
        >
          <UserCog className="w-5 h-5 text-white" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="text-right">ניהול משתמשים ובקשות גישה</SheetTitle>
        </SheetHeader>

        <div className="flex gap-2 mt-4 border-b">
          <button
            onClick={() => setTab("requests")}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", tab === "requests" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            בקשות גישה {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setTab("users")}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", tab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            משתמשים ({users.length})
          </button>
          <button
            onClick={() => setTab("preview")}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", tab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            תצוגה
          </button>
        </div>

        {tab === "preview" && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">תצוגת תפקיד</span>
              <Select value={previewRole || "admin"} onValueChange={(v) => setPreviewRole(v === "admin" ? null : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">תצוגת מנהל</SelectItem>
                  <SelectItem value="סגל">תצוגת סגל</SelectItem>
                  <SelectItem value="רסר">תצוגת רסר</SelectItem>
                  <SelectItem value="קלפ">תצוגת קלפ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {previewRole === "קלפ" && (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">פלוגה לתצוגה</span>
                <Select value={previewPluga || ""} onValueChange={setPreviewPluga}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="בחר פלוגה" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLUGOT.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">
              בחר תפקיד כדי לצפות באפליקציה כפי שהיא נראית לבעל התפקיד. בחר "תצוגת מנהל" כדי לחזור למצב רגיל.
            </p>
          </div>
        )}

        {tab === "requests" && (
          <div className="mt-4 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">אין בקשות גישה חדשות</p>
              </div>
            ) : (
              requests.map((r) => {
                const role = currentRole(r.id);
                return (
                  <div key={r.id} className="border rounded-lg p-4 bg-white space-y-3">
                    <div>
                      <p className="font-medium text-sm">{r.email}</p>
                      {r.full_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.full_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">תפקיד:</span>
                      <Select
                        value={role}
                        onValueChange={(v) => setRoleOverrides((prev) => ({ ...prev, [r.id]: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((rl) => (
                            <SelectItem key={rl} value={rl}>{rl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {role === "קלפ" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">פלוגה:</span>
                        <Select
                          value={plugaOverrides[r.id] || ""}
                          onValueChange={(v) => setPlugaOverrides((prev) => ({ ...prev, [r.id]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="בחר פלוגה" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLUGOT.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(r)}
                        disabled={processing === r.id || (role === "קלפ" && !plugaOverrides[r.id])}
                        className="flex-1 gap-1.5"
                      >
                        {processing === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        אישור והזמנה
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeny(r)}
                        disabled={processing === r.id}
                        className="gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        דחייה
                      </Button>
                    </div>
                    {role === "קלפ" && !plugaOverrides[r.id] && (
                      <p className="text-xs text-amber-600">נדרש לבחור פלוגה לפני אישור</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "users" && (
          <div className="mt-4 space-y-3">
            {users.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">אין משתמשים</p>
              </div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="border rounded-lg p-3 bg-white space-y-2">
                  <div>
                    <p className="font-medium text-sm">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">תפקיד:</span>
                    <Select
                      value={u.role || "user"}
                      onValueChange={(v) => handleUpdateUserRole(u.id, v)}
                      disabled={updatingUser === u.id || u.id === user?.id}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">user</SelectItem>
                        {ROLES.map((rl) => (
                          <SelectItem key={rl} value={rl}>{rl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {updatingUser === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  </div>
                  {u.role === "קלפ" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">פלוגה:</span>
                      <Select
                        value={u.pluga || ""}
                        onValueChange={(v) => handleUpdateUserPluga(u.id, v)}
                        disabled={updatingUser === u.id}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="בחר פלוגה" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLUGOT.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {u.role === "קלפ" && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">אחראי משיכות ציוד</span>
                      <Switch
                        checked={!!u.equipment_manager}
                        onCheckedChange={(v) => handleToggleEquipmentManager(u.id, v)}
                        disabled={updatingUser === u.id}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}