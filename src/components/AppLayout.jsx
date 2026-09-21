import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import TopNav from "./TopNav";
import AdminPanel from "./AdminPanel";
import NotificationsBell from "./NotificationsBell";
import { usePreviewRole } from "@/lib/previewRoleContext";

const LOGO_URL = "/images/emblem.webp";
const WATERMARK_URL = "/images/watermark.webp";
const HEADER_IMAGE_URL = "/images/header-title.webp";

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
  const { previewRole } = usePreviewRole();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const effectiveRole = previewRole || user.role;
    const allowed = ROLE_PAGES[effectiveRole];
    if (allowed && !allowed.includes(location.pathname)) {
      navigate(ROLE_DEFAULT_PAGE[effectiveRole] || "/", { replace: true });
    }
  }, [user, location.pathname, previewRole]);

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 relative">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05] bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${WATERMARK_URL})` }} />
      
      <div className="relative z-10">
        <div className="shadow-sm">
          <header className="bg-black text-white border-b border-slate-800">
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
              <img src={LOGO_URL} alt="סמל" className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="flex-1 flex items-center justify-center">
                <img src={HEADER_IMAGE_URL} alt="Binder Done That" className="h-10 sm:h-12 object-contain" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <NotificationsBell />
                <img src="/images/header-icon.webp" alt="" className="h-10 w-10 object-contain" />
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