import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";
import AdminPanel from "./AdminPanel";
import NotificationsBell from "./NotificationsBell";
import CommandPalette, { useCommandPaletteHotkey } from "./CommandPalette";
import WhatsNewBanner from "./WhatsNewBanner";
import { Search } from "lucide-react";
import PushAutoSubscribe from "./PushAutoSubscribe";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { PAGE_TITLES } from "@/lib/pageTitles";
import { ROLE_PAGES, ROLE_DEFAULT_PAGE } from "@/lib/rolePages";
import { PageTitleProvider, usePageTitleValue } from "@/lib/pageTitleContext";

const LOGO_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/98fcd8299_image.png";
const CHARACTER_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/89a22bb0d_image.png";
const WATERMARK_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/97bf84ed7_image.png";
const HEADER_IMAGE_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/a3148ebb9_image.png";

// Role-based page allowlist + per-role landing page live in
// src/lib/rolePages.js (shared with the global search).

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
  const { previewRole } = usePreviewRole();
  // Global search (src/components/CommandPalette.jsx) — Ctrl/⌘+K, "/", or
  // the search button in the header.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteHotkey(setPaletteOpen);
  // Fires the "land on my role's real default tab" redirect (see the effect
  // below) exactly once per mount, i.e. once per full page load/login — not
  // on every later navigation back to "/", which is still a legitimate nav
  // target the person can click back to on purpose (see ROLE_ORDER in
  // TopNav.jsx, which still lists "/" for every role).
  const didInitialDefaultRedirect = useRef(false);
  // Whether the app was opened on a deep link ("/?gap=…", "/?new=1"). Read
  // once at mount: the target page strips its query params as soon as it
  // consumes them — before the user has even loaded — so checking the live
  // location later would wrongly treat it as a bare "/".
  const landedOnDeepLink = useRef(!!location.search);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const effectiveRole = previewRole || user.role;
    const allowed = [...(ROLE_PAGES[effectiveRole] || [])];

    // Land on this role's real default tab once, right after login — "/" is
    // itself an allowed page for every role (see ROLE_PAGES above), so
    // without this a קלפ landing on "/" after signing in would just stay
    // there instead of reaching "המשימות שלי" (/klaf), their intended
    // default (see ROLE_DEFAULT_PAGE below). Only fires once per mount so
    // deliberately navigating back to "/" via TopNav afterwards still works.
    if (!didInitialDefaultRedirect.current) {
      didInitialDefaultRedirect.current = true;
      const roleDefault = ROLE_DEFAULT_PAGE[effectiveRole];
      // Only for a bare "/" — a deep link like "/?gap=<id>" or "/?new=1"
      // (shared link, push notification, bookmark) must land where it points.
      if (location.pathname === "/" && !landedOnDeepLink.current && roleDefault && roleDefault !== "/" && allowed.includes(roleDefault)) {
        navigate(roleDefault, { replace: true });
        return;
      }
    }

    if (!allowed.includes(location.pathname)) {
      navigate(ROLE_DEFAULT_PAGE[effectiveRole] || "/", { replace: true });
    }
  }, [user, location.pathname, previewRole]);

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
      <PushAutoSubscribe user={user} />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05] bg-contain bg-center bg-no-repeat print:hidden"
        style={{ backgroundImage: `url(${WATERMARK_URL})` }} />

      <div className="relative z-10">
        <div className="sticky top-0 z-20 shadow-sm bg-black print:hidden">
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
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  title="חיפוש בכל המערכת (Ctrl+K)"
                  aria-label="חיפוש"
                >
                  <Search className="w-5 h-5 text-white" />
                </button>
                <NotificationsBell />
                <img src="https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/dc1eb7964_image.png" alt="" className="hidden sm:block h-10 w-10 object-contain shrink-0" />
                <AdminPanel />
              </div>
            </div>
          </header>
          <TopNav />
        </div>
        {pageInfo && (
          <div className="bg-white border-b border-border px-4 py-2.5 print:hidden">
            <div className="max-w-6xl mx-auto flex items-center gap-2">
              {PageIcon && <PageIcon className="w-4 h-4 text-slate-500 shrink-0" />}
              <h1 className="text-base font-bold text-slate-900">{pageInfo.label}</h1>
            </div>
          </div>
        )}
        {user && <div className="print:hidden"><WhatsNewBanner /></div>}
        <Outlet />
      </div>
      {user && (
        <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} effectiveRole={previewRole || user.role} />
      )}
    </div>);

}