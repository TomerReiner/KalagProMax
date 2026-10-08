import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { WHATS_NEW_VERSION } from "@/lib/guideContent";

// One-time "מה חדש" strip under the page title, until dismissed on this
// device (localStorage — a per-viewer convenience; if storage is blocked it
// just shows each visit and the X still hides it for the session).
const KEY = "whatsNewSeen";

function seen() {
  try {
    return localStorage.getItem(KEY) === WHATS_NEW_VERSION;
  } catch {
    return false;
  }
}

export default function WhatsNewBanner() {
  const [hidden, setHidden] = useState(seen);
  const location = useLocation();
  if (hidden || location.pathname === "/guide") return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, WHATS_NEW_VERSION);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-gradient-to-l from-amber-50 to-white border-b border-amber-200">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          <span className="font-semibold">חדש במערכת:</span> תמונת מצב גדודית, חיפוש בכל המערכת (Ctrl+K), שיבוץ שוטף אוטומטי, צ'קליסט לאירועים, ספר קשר ועוד
        </span>
        <Link to="/guide" onClick={dismiss} className="text-xs font-semibold text-slate-900 hover:underline shrink-0">
          לכל החידושים
        </Link>
        <button onClick={dismiss} className="p-1 rounded hover:bg-amber-100 shrink-0" aria-label="סגור">
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
