import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { UserCog, Check, X, Loader2, Mail, Users, FlaskConical, RotateCcw, LogOut, ChevronDown, ChevronUp, Megaphone, Send, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PLUGOT, PLUGA_COLORS } from "@/lib/constants";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { cn } from "@/lib/utils";
import { isTestMode, disableTestMode } from "@/lib/testMode";
import { resetTestData } from "@/testdata/mockStore";
import { PERMISSION_LIST, hasPermission } from "@/lib/permissions";

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
  const [permissions, setPermissions] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [togglingPerm, setTogglingPerm] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [deletingAnn, setDeletingAnn] = useState(null);
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

  const loadPermissions = useCallback(async () => {
    try {
      const data = await base44.entities.UserPermission.list();
      setPermissions(data);
    } catch {
      // ignore
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await base44.entities.Announcement.list("-created_date", 100);
      setAnnouncements(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    loadRequests();
    loadUsers();
    loadPermissions();
    loadAnnouncements();
    const unsubscribe = base44.entities.AccessRequest.subscribe(() => loadRequests());
    return unsubscribe;
  }, [user, loadRequests, loadUsers, loadPermissions, loadAnnouncements]);

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

  const permsFor = (userId) => permissions.filter((p) => p.user_id === userId);

  // pluga === null toggles a global grant (playbox_orders); otherwise a
  // scoped grant for that one pluga. Multiple plugot for the same
  // permission are just multiple rows — see src/lib/permissions.js.
  const handleTogglePermission = async (userId, permissionKey, pluga) => {
    const busyKey = `${userId}_${permissionKey}_${pluga || "global"}`;
    setTogglingPerm(busyKey);
    try {
      const existing = permissions.find((p) =>
        p.user_id === userId &&
        p.permission === permissionKey &&
        (pluga == null ? p.pluga == null : p.pluga === pluga)
      );
      if (existing) {
        await base44.entities.UserPermission.delete(existing.id);
        toast({ title: "ההרשאה הוסרה", duration: 1500 });
      } else {
        await base44.entities.UserPermission.create({ user_id: userId, permission: permissionKey, pluga: pluga || null });
        toast({ title: "ההרשאה הוענקה", duration: 1500 });
      }
      await loadPermissions();
    } catch (err) {
      console.error(err);
      toast({ title: "שגיאה בעדכון ההרשאה", description: err.message, variant: "destructive" });
    } finally {
      setTogglingPerm(null);
    }
  };

  // Creates the announcement row (same client-side pattern every other
  // admin-managed table here uses), then asks the server to actually push it
  // out — that part needs the VAPID private key, so it can't happen in the
  // browser (see api/publish-announcement.js).
  const handlePublishAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    setPublishing(true);
    try {
      const created = await base44.entities.Announcement.create({
        title: annTitle.trim(),
        body: annBody.trim(),
      });
      setAnnTitle("");
      setAnnBody("");
      await loadAnnouncements();
      try {
        const result = await base44.functions.invoke("publishAnnouncement", { announcement_id: created.id });
        toast({ title: "ההודעה פורסמה ונשלחה כהתראה", description: `נשלח ל-${result.sent} מכשירים`, duration: 3000 });
      } catch (pushErr) {
        // The announcement itself is saved either way — it'll show up in
        // everyone's notifications bell — only the phone-push part failed.
        toast({ title: "ההודעה נשמרה, אך שליחת ההתראה נכשלה", description: pushErr.message, variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "שגיאה בפרסום ההודעה", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    setDeletingAnn(id);
    try {
      await base44.entities.Announcement.delete(id);
      await loadAnnouncements();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingAnn(null);
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
          <button
            onClick={() => setTab("announcements")}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", tab === "announcements" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            הודעות
          </button>
        </div>

        {tab === "preview" && (
          <div className="mt-4 space-y-4">
            {isTestMode() && (
              <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 text-sm font-medium">
                  <FlaskConical className="w-4 h-4" />
                  מצב בדיקה פעיל — נתונים מקומיים בלבד, לא נשמר ב-Supabase
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => { resetTestData(); toast({ title: "נתוני הבדיקה אופסו", duration: 2000 }); }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    אפס נתוני בדיקה
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => { disableTestMode(); window.location.href = "/login"; }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    יציאה ממצב בדיקה
                  </Button>
                </div>
              </div>
            )}
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
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                          {p}
                        </span>
                      </SelectItem>
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
                              <SelectItem key={p} value={p}>
                                <span className="flex items-center gap-2">
                                  <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                                  {p}
                                </span>
                              </SelectItem>
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
                            <SelectItem key={p} value={p}>
                              <span className="flex items-center gap-2">
                                <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                                {p}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedUser((cur) => (cur === u.id ? null : u.id))}
                    className="w-full flex items-center justify-between pt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>הרשאות מיוחדות{permsFor(u.id).length > 0 ? ` (${permsFor(u.id).length})` : ""}</span>
                    {expandedUser === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {expandedUser === u.id && (
                    <div className="space-y-3 pt-1 border-t">
                      {u.role === "admin" ? (
                        <p className="text-xs text-muted-foreground pt-2">
                          מנהלים מחזיקים אוטומטית בכל ההרשאות, לכל הפלוגות — אין צורך להעניק דרך כאן.
                        </p>
                      ) : PERMISSION_LIST.map((perm) => {
                        const userPerms = permsFor(u.id);
                        return (
                          <div key={perm.key} className="space-y-1.5 pt-2">
                            <div>
                              <p className="text-xs font-medium">{perm.label}</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{perm.description}</p>
                            </div>
                            {perm.scoped ? (
                              <div className="flex flex-wrap gap-2.5">
                                {PLUGOT.map((p) => {
                                  const busyKey = `${u.id}_${perm.key}_${p}`;
                                  const checked = hasPermission(userPerms, perm.key, p);
                                  return (
                                    <label
                                      key={p}
                                      className={cn(
                                        "flex items-center gap-1.5 text-xs cursor-pointer rounded-full px-2 py-1 transition-colors",
                                        checked && PLUGA_COLORS[p]?.light
                                      )}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={togglingPerm === busyKey}
                                        onCheckedChange={() => handleTogglePermission(u.id, perm.key, p)}
                                      />
                                      <span className={cn("w-2 h-2 rounded-full", PLUGA_COLORS[p]?.dot)} />
                                      {p}
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">מוענק (כלל־ארגוני)</span>
                                <Switch
                                  checked={hasPermission(userPerms, perm.key)}
                                  disabled={togglingPerm === `${u.id}_${perm.key}_global`}
                                  onCheckedChange={() => handleTogglePermission(u.id, perm.key, null)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "announcements" && (
          <div className="mt-4 space-y-4">
            <div className="border rounded-lg p-3 bg-white space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Megaphone className="w-4 h-4" />
                הודעה חדשה
              </div>
              <Input
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="כותרת ההודעה"
              />
              <Textarea
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="תוכן ההודעה"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                ההודעה תופיע להתראות אצל כל המשתמשים, ותישלח גם כהתראת Push למכשירים שנרשמו (ראו "אזור אישי").
              </p>
              <Button
                onClick={handlePublishAnnouncement}
                disabled={publishing || !annTitle.trim() || !annBody.trim()}
                className="w-full gap-1.5"
              >
                {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                פרסם ושלח התראה
              </Button>
            </div>

            {announcements.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">אין הודעות עדיין</p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcements.map((a) => (
                  <div key={a.id} className="border rounded-lg p-3 bg-white space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{a.title}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        disabled={deletingAnn === a.id}
                        className="shrink-0 p-1 rounded hover:bg-red-50 text-red-500"
                      >
                        {deletingAnn === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(a.created_date).toLocaleString("he-IL")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}