import { createContext, useContext, useState, useCallback, useEffect } from "react";

// Lets a single route show more than one real title depending on what it's
// actually displaying right now — the one concrete case today is
// src/pages/Klaf.jsx: a real קלפ sees "המשימות שלי" (its PAGE_TITLES
// default, see src/lib/pageTitles.js), but the SAME route ("/klaf") shown to
// someone who only holds the delegated meal_regulators permission renders a
// completely different, much narrower page (see Klaf.jsx's isDelegatedOnly
// branch) that should say "מווסתים" instead — a plain path→title map
// (PAGE_TITLES) can't express that, since it only knows the URL, not what
// the component behind it chose to render.
const PageTitleContext = createContext(null);

export function PageTitleProvider({ children }) {
  const [override, setOverrideState] = useState(null);
  const setOverride = useCallback((value) => setOverrideState(value), []);
  return (
    <PageTitleContext.Provider value={{ override, setOverride }}>
      {children}
    </PageTitleContext.Provider>
  );
}

// Read by AppLayout.jsx's title bar: null means "no override, fall back to
// this route's PAGE_TITLES default".
export function usePageTitleValue() {
  const ctx = useContext(PageTitleContext);
  return ctx?.override ?? null;
}

// Called by a page component to override its route's default title for as
// long as it's mounted (and whenever label/icon change) — pass label=null
// (or just render without calling it) to use the plain route default.
// Always call this unconditionally near the top of the component, before
// any early `return`, same as any other hook.
export function usePageTitleOverride(label, icon) {
  const ctx = useContext(PageTitleContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setOverride(label ? { label, icon } : null);
    // Clear on unmount / before the next effect run so navigating away
    // (or the override condition turning false) doesn't leave a stale
    // title behind for whatever route is shown next.
    return () => ctx.setOverride(null);
  }, [ctx, label, icon]);
}
