import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";
import AdminPanel from "./AdminPanel";
import NotificationsBell from "./NotificationsBell";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { hasPermission, plugotFor, effectivePermissions } from "@/lib/permissions";
import { PAGE_TITLES } from "@/lib/pageTitles";
import { PageTitleProvider, usePageTitleValue } from "@/lib/pageTitleContext";

const LOGO_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/98fcd8299_image.png";
const CHARACTER_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/89a22bb0d_image.png";
const WATERMARK_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/97bf84ed7_image.png";
const HEADER_IMAGE_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/a3148ebb9_image.png";

// Role-based page allowlist. Delegated permissions (src/lib/permissions.js)
// can widen this for a specific signed-in user regardless of role — see the
// extraAllowedPages logic below, which adds "/playbox" for a playbox_orders
// grant and "/klaf" for a meal_regulators grant (both personal, independent
// of role, so any role might hold one).
// "/personal" (אזור אישי) is reachable by every role — it's the new home for
// the equipment/playbox links that used to be their own top-nav items (see
// TopNav.jsx / src/pages/PersonalArea.jsx), plus push-notification opt-in
// for everyone. "/equipment" and "/playbox" themselves stay in this
// allowlist for the roles that could already reach them, since PersonalArea
// links straight into those pages rather than duplicating them.
const ROLE_PAGES = {
  admin: ["/", "/daily-summary", "/shotaf", "/constraints", "/tasks", "/statistics", "/equipment", "/personal"],
  קלפ: ["/", "/daily-summary", "/constraints", "/klaf", "/equipment", "/personal"],
  רסר: ["/", "/constraints", "/statistics", "/personal"],
  סגל: ["/", "/constraints", "/statistics", "/personal"],
};

const ROLE_DEFAULT_PAGE = {
  admin: "/",
  קלפ: "/klaf",
  רסר: "/",
  סגל: "/",
};

// Wraps everything in PageTitleProvider so a page rendered inside <Outlet/>
// (see src/lib/pageTitleContext.jsx — today, just src/pages/Klaf.jsx) can
// override the route's default PAGE_TITLES entry, and the title bar below
// can read that override back. The provider has to sit above both sides —
// the title bar that reads it and the Outlet that sets it — so it wraps the
// actual implementation instead of living inside it.
export default function AppLayout() {
  return (
    <PageTitleProvider>
      <AppLayoutInner />
    </PageTitleProvider>
  );
}

function AppLayoutInner() {
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

  // A page can override its route's default title (see
  // src/lib/pageTitleContext.jsx) — e.g. /klaf shows "המשימות שלי" by
  // default, but the same route's isDelegatedOnly view calls
  // usePageTitleOverride to show "מווסתים" instead, since a plain
  // path→title map can't tell those two views apart.
  const titleOverride = usePageTitleValue();
  const pageInfo = titleOverride || PAGE_TITLES[location.pathname];
  const PageIcon = pageInfo?.icon;

  // Browser/PWA tab title, so it's also clear which tab this is from the
  // OS task switcher or a phone's tab list, not just the in-page header
  // below.
  useEffect(() => {
    document.title = pageInfo ? `${pageInfo.label} - Binder Done That` : "Binder Done That";
  }, [pageInfo]);

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 relative overflow-x-hidden">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05] bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${WATERMARK_URL})` }} />

      <div className="relative z-10">
        <div className="sticky top-0 z-20 shadow-sm bg-black">
          <header className="bg-black text-white border-b border-slate-800">
            <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 flex items-center justify-between gap-1 sm:gap-3">
              <img src={LOGO_URL} alt="סמל" className="w-9 h-9 rounded-full object-cover shrink-0" />
              {/* min-w-0 is the actual fix here: a flex item's default
                  min-width is "auto" (its content's natural size), so
                  without it this banner image refused to shrink below its
                  own width and forced the whole header — and with it the
                  whole page — wider than the phone's screen. max-w-full on
                  the image is the other half: it lets the image's rendered
                  width actually shrink to whatever this container ends up
                  with, instead of just clipping. */}
              <div className="flex-1 min-w-0 flex items-center justify-center overflow-hidden">
                <img src={HEADER_IMAGE_URL} alt="Binder Done That" className="max-h-10 sm:max-h-12 max-w-full w-auto object-contain" />
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <NotificationsBell />
                <img src="https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/dc1eb7964_image.png" alt="" className="hidden sm:block h-10 w-10 object-contain shrink-0" />
                <AdminPanel />
              </div>
            </div>
          </header>
          <TopNav />
        </div>
        {pageInfo && (
          <div className="bg-white border-b border-border px-4 py-2.5">
            <div className="max-w-6xl mx-auto flex items-center gap-2">
              {PageIcon && <PageIcon className="w-4 h-4 text-slate-500 shrink-0" />}
              <h1 className="text-base font-bold text-slate-900">{pageInfo.label}</h1>
            </div>
          </div>
        )}
        <Outlet />
      </div>
    </div>);

}