import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";
import AdminPanel from "./AdminPanel";
import NotificationsBell from "./NotificationsBell";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { hasPermission, plugotFor, effectivePermissions } from "@/lib/permissions";

const LOGO_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/98fcd8299_image.png";
const CHARACTER_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/89a22bb0d_image.png";
const WATERMARK_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/97bf84ed7_image.png";
const HEADER_IMAGE_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/a3148ebb9_image.png";

// Role-based page allowlist. Delegated permissions (src/lib/permissions.js)
// can widen this for a specific signed-in user regardless of role — see the
// extraAllowedPages logic below, which adds "/playbox" for a playbox_orders
// grant and "/klaf" for a meal_regulators grant (both personal, independent
// of role, so any role might hold one).
const ROLE_PAGES = {
  admin: ["/", "/daily-summary", "/shotaf", "/constraints", "/tasks", "/statistics", "/equipment"],
  קלפ: ["/", "/daily-summary", "/constraints", "/klaf", "/equipment"],
  רסר: ["/", "/constraints", "/statistics"],
  סגל: ["/", "/constraints", "/statistics"],
};

const ROLE_DEFAULT_PAGE = {
  admin: "/",
  קלפ: "/klaf",
  רסר: "/",
  סגל: "/",
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole } = usePreviewRole();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setMyPermissions([]); return; }
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const effectiveRole = previewRole || user.role;
    const allowed = [...(ROLE_PAGES[effectiveRole] || [])];
    // Admins hold every delegated permission automatically — use the REAL
    // role here, never the previewed one, so previewing as another role
    // never hands that role an admin's access (see effectivePermissions).
    const delegatedPermissions = effectivePermissions(myPermissions, user.role);
    if (hasPermission(delegatedPermissions, "playbox_orders")) allowed.push("/playbox");
    if (plugotFor(delegatedPermissions, "meal_regulators").length > 0 && !allowed.includes("/klaf")) allowed.push("/klaf");
    if (!allowed.includes(location.pathname)) {
      navigate(ROLE_DEFAULT_PAGE[effectiveRole] || "/", { replace: true });
    }
  }, [user, location.pathname, previewRole, myPermissions]);

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 relative">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05] bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${WATERMARK_URL})` }} />
      
      <div className="relative z-10">
        <div className="sticky top-0 z-20 shadow-sm bg-black">
          <header className="bg-black text-white border-b border-slate-800">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
              <img src={LOGO_URL} alt="סמל" className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="flex-1 flex items-center justify-center">
                <img src={HEADER_IMAGE_URL} alt="Binder Done That" className="h-10 sm:h-12 object-contain" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <NotificationsBell />
                <img src="https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/dc1eb7964_image.png" alt="" className="h-10 w-10 object-contain" />
                <AdminPanel />
              </div>
            </div>
          </header>
          <TopNav />
        </div>
        <Outlet />
      </div>
    </div>);

}