# בינדר דאן דאט (Binder Done That) — מסמך תיעוד למפתח/AI

> מסמך זה מתעד את מלוא הפרויקט כדי לאפשר כניסה לקוד ללא context מוקדם.
> **הפרויקט יוצא מ-Base44 והועבר ל-Supabase (DB/Auth/Storage/Realtime) + Vercel (אחסון + פונקציות serverless).**
> `AGENTS.md` ו-`README.md` עדיין מתארים את זרימת Base44 הישנה (`base44 dev`, `base44 link`) — **לא רלוונטיים יותר**.
> מדריך ההקמה של התשתית החדשה: `README-SUPABASE.md`.

---

## 1. מהות הפרויקט

מערכת פנימית לניהול ומעקב אחר **פערים וליקויים באתרי בנייה** (מתחם קמנים/מדרכה), עם דגש על תיעדוף משימות, סינון חכם, ועדכונים בזמן אמת לצוות העבודה. המערכת משמשת מספר תפקידים (admin, קלפ, רסר, סגל) בעלי הרשאות ותצוגות שונות, ומנהלת גם שוטף יומי (מסדר בוקר, ניקויים), אילוצים/אירועים, משימות ישירות, סטטיסטיקה, ומשיכות ציוד ממחסנים.

**שפת ממשק:** עברית, RTL מלא (`dir="rtl"`). כותרת האתר: "Binder Done That - קמנים 204 אימפריה!".
**שפת קוד:** JavaScript (JSX) בפרונטאנד וב-`/api` (ESM). אין TypeScript (למעט `src/utils/index.ts`).
**שם החבילה:** `kalagpromax`.

---

## 2. סטאק טכנולוגי

- **פרונטאנד:** React 18 + Vite + Tailwind CSS + shadcn/ui (Radix primitives)
- **ראוטינג:** react-router-dom v6
- **סטייט/קוורי:** @tanstack/react-query (`src/lib/query-client.js`)
- **Backend-as-a-service:** Supabase — Postgres + RLS, Auth (Google OAuth + אימייל/סיסמה עם OTP), Storage, Realtime
- **פונקציות שרת:** Vercel Serverless Functions בתיקיית `/api` (Node, ESM, `req/res` בסגנון Express)
- **אחסון פרונטאנד:** Vercel (build: `npm run build`, output: `dist`)
- **אייקונים:** lucide-react (בלבד) · **Excel:** xlsx · **תאריכים:** date-fns + moment · גם מותקנים: jspdf, html2canvas, framer-motion, canvas-confetti, @hello-pangea/dnd

---

## 3. ארכיטקטורה — הדבר החשוב ביותר להבין

### 3.1 ה-shim: `src/api/base44Client.js`
כל הדפים והרכיבים נכתבו מול אובייקט `base44` של ה-SDK הישן. במקום לשכתב אותם, הקובץ הזה **מממש את אותו API מעל Supabase**. לכן בקוד עדיין כתוב `import { base44 } from "@/api/base44Client"` — **זה תקין וזו הקונבנציה. אל תוסיף `@base44/sdk`, ואל תעבור ישירות ל-`supabase` בדפים** (חוץ מ-`AuthContext` ו-`ResetPassword`).

| קריאה בקוד | מה קורה בפועל |
|---|---|
| `base44.entities.X.list(sort, limit)` | `supabase.from(table).select('*')` + `order`/`limit`. sort כמחרוזת, `-field` = יורד |
| `.filter({k: v}, sort, limit)` | `.eq(k, v)` לכל מפתח — **שוויון בלבד**, אין אופרטורים אחרים |
| `.get(id)` / `.update(id, data)` / `.delete(id)` | לפי `id` |
| `.create(data)` / `.bulkCreate([...])` | insert + **חתימת `created_by` (אימייל) ו-`created_by_id` (uuid)** אוטומטית (חוץ מ-`User`) |
| `.subscribe(cb)` | ערוץ `postgres_changes`; ה-callback נקרא **ללא payload** (רק טריגר לרענון); מחזיר unsubscribe |
| `base44.auth.me()` | קורא `profiles`; **זורק 403 `user_not_registered` אם אין `role`** → מציג מסך "בקש גישה" |
| `base44.auth.updateMe({notifications_last_read})` | RPC `mark_notifications_read` (עדכון עצמי מוגבל). כל שדה אחר — `update` ישיר על ה-profile של עצמך |
| `base44.auth.loginWithProvider("google", returnTo)` | `signInWithOAuth` |
| `base44.auth.register / verifyOtp / resendOtp / resetPasswordRequest / resetPassword / logout / redirectToLogin / isAuthenticated` | מקבילים ב-Supabase Auth |
| `base44.functions.invoke("camelName", body)` | `POST /api/<kebab-case-name>` עם `Authorization: Bearer <access_token>`. שגיאה: `err.response.data.error` |
| `base44.integrations.Core.UploadPublicFile({file})` | העלאה ל-bucket ציבורי `attachments`, מחזיר `{file_url}` |
| `base44.users.inviteUser(email, "user"\|"admin")` | `invoke("inviteUser")` → `/api/invite-user` |

**מיפוי ישות → טבלה** (snake_case, ריבוי): `AccessRequest→access_requests`, `Constraint→constraints`, `DailyRoutine→daily_routines`, `DailySummary→daily_summaries`, `DirectTask→direct_tasks`, `EquipmentHolding→equipment_holdings`, `EquipmentSettings→equipment_settings`, `Event→events`, `Gap→gaps`, `GapUpdate→gap_updates`, `RecurringEvent→recurring_events`, `RecurringOverride→recurring_overrides`, `TaskCompletion→task_completions`, `WarehouseItem→warehouse_items`, `WithdrawalRequest→withdrawal_requests`, **`User→profiles`**.

**להוספת ישות/שדה חדש:** (1) migration חדש ממוספר ב-`supabase/migrations/`, (2) שורה ב-`entities` ב-`base44Client.js`, (3) RLS + (אם צריך realtime) `alter publication supabase_realtime add table`. שמות השדות זהים לאלה שבקוד — אין שכבת תרגום.

### 3.2 שני clients של Supabase
- **דפדפן:** `src/lib/supabaseClient.js` — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. כפוף ל-RLS.
- **שרת:** `api/_lib/supabaseAdmin.js` — `getSupabaseAdmin()` עם `SUPABASE_SERVICE_ROLE_KEY` (**עוקף RLS**), ו-`getCallerProfile(req, admin)` שמאמת את ה-Bearer token ומחזיר `{user, profile}` או `null`. **כל פונקציה ב-`/api` חייבת לבדוק בעצמה זהות והרשאה.** לעולם לא לייבא את הקובץ הזה מ-`src/`.

### 3.3 משתני סביבה
| משתנה | איפה | הערה |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | דפדפן (Vercel + `.env.local`) | ציבוריים |
| `SUPABASE_URL` | פונקציות `/api` | |
| `SUPABASE_SERVICE_ROLE_KEY` | פונקציות `/api` בלבד | **סוד. לעולם לא עם קידומת `VITE_`, לא בצ'אט/כלי AI, לא ב-git** |

`.env*` ב-`.gitignore`. אין `.env.example` בפועל, למרות שהודעת השגיאה ב-`supabaseClient.js` מפנה אליו.

---

## 4. מבנה תיקיות

```
api/                          # Vercel serverless functions (ESM)
  _lib/supabaseAdmin.js       # service-role client + אימות קורא
  submit-access-request.js    # ציבורי (בלי אימות)
  process-withdrawal.js       # כל משתמש מחובר
  approve-withdrawal.js       # admin / equipment_manager
  invite-user.js              # admin בלבד
supabase/migrations/
  0001_init.sql               # כל הטבלאות, RLS, טריגרים, realtime, bucket
  0001a_fix_role_check_constraints.sql   # תיקון CHECK של קלפ (פ רגילה, לא ף) — אידמפוטנטי
  0002_seed_data.sql          # נתונים היסטוריים מ-Base44 (+ מרחיב task_type ל-'direct')
  0003_tighten_permissions.sql # הסרת role מ-metadata בטריגר + RLS שדורש משתמש רשום (is_registered) + Storage מוקשח
public/                       # favicon.ico, favicon-32.png, apple-touch-icon.png, icon-192/512.png, logo.webp, manifest.json
src/
  api/base44Client.js         # ה-shim (ראו §3.1)
  App.jsx, main.jsx
  index.css                   # טוקני עיצוב HSL + פונט Rubik
  lib/  AuthContext.jsx, supabaseClient.js, previewRoleContext.jsx, constants.js,
        calendarLayout.js, authReturnTo.js, query-client.js, utils.js (cn), PageNotFound.jsx
        app-params.js         # שריד Base44 — מיובא רק ע"י OAuthConsent (לא מנותב). ייבוא ממנו ישבור בנייה: אין @base44/sdk ב-package.json
  components/
    AppLayout.jsx, TopNav.jsx, AdminPanel.jsx, NotificationsBell.jsx, ProtectedRoute.jsx,
    AuthLayout.jsx, GoogleIcon.jsx, ScrollToTop.jsx, TimeInput.jsx, TimeSelect.jsx, UserNotRegisteredError.jsx
    ui/                       # shadcn primitives (+ image.jsx, image-helpers.js)
    gaps/  constraints/  equipment/  klaf/  statistics/  tasks/(StandaloneTaskForm)
  pages/  Home, Shotaf, Constraints, DailySummary, Tasks, Klaf, Statistics, Equipment,
          Login, Register, ForgotPassword, ResetPassword, OAuthConsent (לא מנותב)
base44/                       # שריד מהפלטפורמה הישנה: סכמות jsonc, פונקציות entry.ts, config — לא בשימוש בריצה.
                              # שימושי כמסמך ייחוס לסכמה המקורית בלבד
vercel.json                   # build + rewrites
```

`vercel.json`: `/api/*` → פונקציות; כל השאר → `/index.html` (SPA fallback).

---

## 5. Auth וזרימת גישה

1. **התחברות:** דף `/login` מציע "המשך עם Google" + "בקשת גישה חדשה". `/register` (אימייל+סיסמה+קוד OTP) קיים אך פחות בשימוש; דורש שתבנית המייל של Supabase תשתמש ב-`{{ .Token }}`.
2. **טריגר `handle_new_user`:** כל `auth.users` חדש יוצר שורה ב-`profiles` עם `role`/`pluga` = NULL (מאז `0003` תמיד NULL; רק אדמין קובע).
3. **`role IS NULL` = "לא רשום"** → `auth.me()` זורק 403 → `AuthContext` מציב `authError.type = "user_not_registered"` → `App.jsx` מציג `UserNotRegisteredError` (טופס בקשת גישה שקורא ל-`submitAccessRequest`).
4. **אישור:** ב-`AdminPanel` (טאב "בקשות גישה") אדמין לוחץ "אישור והזמנה" → `inviteUser` (אם אין עדיין profile: `inviteUserByEmail`; אם יש: `already_existed`) → polling עד 6 פעמים ×500ms על `User.list()` → `User.update(role, pluga)` → `AccessRequest.update(status:"approved")`.
5. **מנהל ראשון:** אחרי התחברות ראשונה, לשנות ידנית `profiles.role = 'admin'` ב-Supabase Table Editor.
6. **`AuthContext`** מאזין ל-`onAuthStateChange` (SIGNED_IN/TOKEN_REFRESHED/USER_UPDATED → בדיקה מחדש, SIGNED_OUT → ניקוי). `ProtectedRoute` מגן על הראוטים.
7. **`safeReturnTo()`** (`authReturnTo.js`) — ולידציית `?returnTo=` נגד open-redirect. לא לשנות בלי לחשוב.

---

## 6. ראוטינג ותפקידים

**ראוטים ציבוריים:** `/login`, `/register`, `/forgot-password`, `/reset-password`.
**מוגנים** (`ProtectedRoute` → `AppLayout` + `<Outlet/>`): `/` Home, `/shotaf`, `/constraints`, `/daily-summary`, `/tasks`, `/klaf`, `/statistics`, `/equipment`. **ראוט חדש חייב import + `<Route>` ב-`src/App.jsx`.** `OAuthConsent` הוצא מהראוטינג.

**תפקידים:** `admin`, `קלפ`, `רסר`, `סגל` (ב-DB מותר גם `user`). נשמר ב-`profiles.role`. שימו לב: **"קלפ" עם פ רגילה (U+05E4)**, לא ף.

```js
ROLE_PAGES = {            // src/components/AppLayout.jsx
  admin: ["/", "/daily-summary", "/shotaf", "/constraints", "/tasks", "/statistics", "/equipment"],
  קלפ:  ["/", "/daily-summary", "/constraints", "/klaf", "/equipment"],
  רסר:  ["/", "/constraints", "/statistics"],
  סגל:  ["/", "/constraints", "/statistics"],
}
ROLE_DEFAULT_PAGE = { admin: "/", קלפ: "/klaf", רסר: "/", סגל: "/" }
```
ניגש לעמוד שלא ברשימתו → מופנה לברירת המחדל. **ההגבלה הזו היא UI בלבד** (ראו §10).

`TopNav` מסנן לפי `item.roles`. **Preview Role:** אדמין יכול לצפות כקלפ/רסר/סגל דרך `AdminPanel`; `previewRole` גובר על `user.role` — תמיד `effectiveRole = previewRole || user.role` (ועם קלפ גם `previewPluga`).

**שדות profile מותאמים:** `role`, `pluga` (פארן/בשור/צין/רמון/תמר — CHECK ב-DB), `equipment_manager` (בוליאני), `notifications_last_read`.

---

## 7. מודל נתונים (Postgres)

כל טבלה תפעולית: `id uuid`, `created_date`, `updated_date` (טריגר `set_updated_date`), `created_by` (אימייל, text), `created_by_id` (uuid → auth.users). **תאריכים ושעות בשדות עסקיים הם `text`** (`YYYY-MM-DD`, `HH:MM`) — לא `date`/`time`. מערכים: `text[]`; אובייקטים: `jsonb`.

| טבלה (ישות) | תכלית | שדות מרכזיים |
|---|---|---|
| `gaps` (Gap) | פער/ליקוי | `company`, `gap`, `location`, `class_name`, `building_number`, `room_number`, `status` (ברירת מחדל 'טרם הועלה'; טרם הועלה/בטיפול/טופל), `priority` ('בינוני'; נמוך→קריטי), `note`, `reporter_name/phone`, `attachments jsonb` |
| `gap_updates` | היסטוריה | `gap_id` (cascade), `update_type`, `field`, `old_value`, `new_value`, `text`, `author_name` |
| `daily_routines` | שוטף יומי | `routine_date`, `morning_assembly_plugas[]`, `frisa_morning`, `noon_cleaning`, `evening_cleaning` (פלוגה או 'טרם הוחלט') |
| `events` | אירוע | `event_type` (חיצוני/פנימי), `event_date`, `start_time`, `end_time`, `title`, `details`, `transport_pluga/details`, `food_pluga/details`, `responsible_plugas[]` |
| `recurring_events` | אירוע חוזר | `title`, `start_time`, `end_time`, `recurrence` (daily/sunday…saturday), `pluga`, `details` |
| `recurring_overrides` | דריסת תאריך | `recurring_event_id` (cascade), `original_date`, `new_date` |
| `constraints` | אילוץ | `pluga` (ישן), `plugas[]`, `constraint_date`, `start_time`, `end_time`, `title`, `details` |
| `direct_tasks` | משימה ישירה | `title`, `pluga`, `responsible_plugas[]`, `task_date`, `start_time`, `end_time`, `status` (פתוחה/טופלה), `notes` |
| `task_completions` | סימון השלמה | `task_type` (event/shotaf/**direct** — הורחב ב-0002), `task_id`, `task_field`, `task_label`, `task_date`, `pluga` |
| `daily_summaries` | סיכום מסדר | `summary_date`, `entries jsonb` ([{area, notes}]) |
| `warehouse_items` | מלאי | `warehouse` (מכולה/מחסן קרביץ/מחסן לוגיסטי), `name`, `quantity numeric`, `returnable` |
| `withdrawal_requests` | בקשת משיכה | `warehouse`, `items jsonb`, `requested_by_name`, `pluga`, `request_date`, `expected_return_date`, `notes`, `status` (pending/approved/rejected), `approved_by_name` |
| `equipment_holdings` | ציוד מחוץ למחסן | `item_name`, `warehouse`, `quantity`, `pluga`, `held_by_name`, `withdrawal_date`, `expected_return_date` |
| `equipment_settings` | הגדרות ציוד | `responsible_klaf_id/name`, `notification_emails[]` |
| `access_requests` | בקשת גישה | `email`, `full_name`, `status` (pending/approved/denied), `assigned_role`, `pluga` |
| `profiles` (User) | משתמש, מסונכרן ל-`auth.users` | `email`, `full_name`, `role`, `pluga`, `equipment_manager`, `notifications_last_read` |

**Realtime מופעל רק על:** `gaps`, `gap_updates`, `access_requests`, `withdrawal_requests`. `.subscribe()` על טבלה אחרת לא יקבל אירועים עד שמוסיפים אותה ל-publication.

**Storage:** bucket ציבורי `attachments` (קריאה ציבורית; העלאה/מחיקה לכל מחובר). קבצים בשם `<uuid>.<ext>`.

**פונקציות SQL:** `set_updated_date()`, `handle_new_user()` (security definer), `is_admin()` (security definer, לשימוש ב-RLS), `mark_notifications_read(read_at)`.

**RLS:**
- `profiles`: SELECT לכל מחובר; UPDATE רק אדמין. (משתמש רגיל מעדכן את עצמו רק דרך ה-RPC.)
- `access_requests`: אדמין בלבד (לכן ההגשה עוברת דרך `/api/submit-access-request`).
- `task_completions`: SELECT — יוצר או אדמין; INSERT — `created_by_id = auth.uid()`; DELETE — יוצר או אדמין; **אין UPDATE**.
- כל השאר: "authenticated full access" — כל מי ש-`auth.uid()` קיים.

---

## 8. פונקציות `/api` (Vercel)

כולן `POST` בלבד (405 אחרת), מחזירות `{success: true, ...}` או `{error}` בעברית עם קוד HTTP מתאים. הפרונטאנד קורא להן דרך `base44.functions.invoke("<camelCase>", body)`; ההמרה ל-kebab אוטומטית.

| קובץ | הרשאה | מה עושה |
|---|---|---|
| `submit-access-request.js` | ציבורי | מנרמל אימייל, 409 אם כבר קיימת בקשה (כל סטטוס), יוצר `access_requests` pending |
| `process-withdrawal.js` | מחובר | דורש `warehouse`, `items[]`, `pluga`; יוצר `withdrawal_requests` pending עם `requested_by_name` מה-profile |
| `approve-withdrawal.js` | admin או `equipment_manager` | `{withdrawal_id, decision: approved\|rejected}`. באישור: בודק מלאי לכל פריט (לפי שם), מוריד כמויות, יוצר `equipment_holdings` לפריטים `returnable`, מעדכן סטטוס. **לא אטומי** — עדכונים נפרדים, ללא טרנזקציה |
| `invite-user.js` | admin | `inviteUserByEmail`; אם ה-profile כבר קיים מחזיר `already_existed` |

**מיילים לא מחוברים.** שני `TODO` (ב-`submit-access-request.js` וב-`process-withdrawal.js`) מסמנים היכן לחבר ספק (למשל Resend). כרגע אדמינים רואים בקשות חדשות בזמן אמת ב-`AdminPanel` ובפעמון; `equipment_settings.notification_emails` נשמר אך לא בשימוש.

---

## 9. דפים ורכיבים מרכזיים

- **Home (`/`)** — פערים: סינון (סטטוס/עדיפות/פלוגה/טקסט/stale), מיון, פעילים/ארכיון, כרטיסי סטטיסטיקה, realtime על `Gap`, ייצוא Excel. כל שינוי סטטוס/עדיפות יוצר `GapUpdate`.
- **Shotaf (`/shotaf`, admin)** — `DailyRoutine` לפי תאריך; שעות דרך `getShotafTime`.
- **Constraints** — אירועים/אילוצים/אירועים חוזרים, לוח שנה עם `calendarLayout.js` (מקבל `{id, top, height}` ומחזיר Map של `{column, totalColumns}`).
- **Klaf (`/klaf`)** — "המשימות שלי": שוטף + אירועים (transport/food/responsible) + `DirectTask`; סימון דרך `TaskCompletion`.
- **Equipment** — 3 מחסנים, בקשות משיכה + אישור (`PendingWithdrawals`), החזרות (`ReturnConfirmDialog`), היסטוריה, "הבקשות שלי", הגדרות, ייצוא Excel.
- **Statistics** — `GapDashboard`, `ActivityTimeline`, `OperationsDashboard`. **DailySummary** — סיכום מסדר. **Tasks (admin)** — משימות ישירות (`StandaloneTaskForm`).
- **AppLayout** — header שחור + לוגו + `NotificationsBell` + `AdminPanel` + `TopNav`.
- **AdminPanel** — 3 טאבים: בקשות גישה, משתמשים (role/pluga/equipment_manager), תצוגה (preview role).
- **NotificationsBell** — עדכוני `GapUpdate` שלא נקראו לפי `notifications_last_read`.
- **GapForm** כולל `AttachmentUploader` (תמונות/וידאו עד 25MB → bucket `attachments`).

---

## 10. נקודות תשומת לב (Gotchas)

**אבטחה — חשוב להכיר:**
- **RLS (אחרי `0003`):** טבלאות תפעוליות דורשות `is_registered()` (profile עם `role` לא-NULL); משתמש שלא אושר לא יכול לקרוא/לכתוב כלום מלבד ה-profile של עצמו. **עדיין אין הפרדה בין תפקידים ב-DB** — `ROLE_PAGES` הוא UI בלבד, וכל משתמש רשום (גם רסר/סגל) יכול לכתוב ישירות ב-API של Supabase. הידוק נוסף = policies לפי `role`.
- **`handle_new_user` (אחרי `0003`)** לא קורא עוד `role`/`pluga` מ-metadata (שהמשתמש שולט בו ב-`signUp`); רק אדמין קובע תפקיד. `role` חדש חייב לעבור דרך `AdminPanel`/UPDATE של אדמין.
- **Storage:** העלאה — משתמש רשום; מחיקה — אדמין בלבד.
- `SUPABASE_SERVICE_ROLE_KEY` עוקף RLS — אף פעם לא לחשוף לדפדפן.

**התנהגות:**
- **פלוגה מוגבלת ב-CHECK:** רק פארן/בשור/צין/רמון/תמר (`PLUGOT` ב-`constants.js`). פלוגה חדשה דורשת migration + עדכון הקבוע.
- **`task_completions`** — אין UPDATE; לשינוי מוחקים ויוצרים.
- **שורות מיובאות מ-Base44** (0002) בעלות `created_by_id = NULL` (המזהה המקורי ב-`created_by`), ולכן `task_completions` שלהן גלויות רק לאדמין.
- **התראות מייל לא קיימות** (ראו §8).
- **ה-`filter`** תומך בשוויון בלבד; סינון מורכב — בצד לקוח או הרחבת ה-shim.
- **`previewRole`** גובר על `user.role` בכל מקום.
- **שעות שוטף** (`SHOTAF_TIMES`): שישי/שבת מוחרגים; יום חמישי (4) — מסדר בוקר מתחיל 07:10.
- **תמונות:** כל התמונות מקומיות ב-`public/` (`images/emblem.webp`, `watermark.webp`, `header-title.webp`, `header-icon.webp`, ועוד האייקונים). כבר אין תלות ב-`media.base44.com`. רכיב `@/components/ui/image` ו-`image-helpers.js` עדיין מטפלים ב-URL של Base44/Wix, אך אינם בשימוש לתמונות האפליקציה.
- **`vite.config.js`** — רק `@vitejs/plugin-react` ואליאס `@`. אין plugin של Base44, ו-`.npmrc` עדיין מכיל `min-release-age` (מתקין לא יתקין גרסאות בנות פחות משבוע).
- **`OAuthConsent.jsx`, `app-params.js`, `base44/`** — שאריות; לא לבנות עליהן.

---

## 11. קונבנציות קוד

- **יבוא:** `import { base44 } from "@/api/base44Client"`; `import { cn } from "@/lib/utils"`; כל פרימיטיב shadcn מקובץ נפרד (`@/components/ui/button`).
- **אייקונים:** lucide-react בלבד; אייקון ששמו זהה לקומפוננטה — alias (`Home as HomeIcon`).
- **Tailwind:** מחרוזות ליטרליות בלבד (purge). טוקני עיצוב ב-`index.css` (HSL) ממופים ב-`tailwind.config.js` — להשתמש ב-`bg-primary`, `font-heading` וכו'.
- **פונט:** Rubik. **RTL:** `dir="rtl"` בכל מקום; דיאלוגים ו-Sheets מציינים `dir="rtl"` במפורש.
- **realtime:** `const unsub = base44.entities.X.subscribe(cb)` ולהחזיר `unsub` ב-cleanup של `useEffect`.
- **שגיאות:** לא לעטוף ב-try/catch אלא בטופס/flow עם הודעה למשתמש. הודעות שגיאה מה-API מגיעות ב-`err.response?.data?.error`.
- **ESM בלבד** (גם ב-`/api`, עם סיומת `.js` בייבוא יחסי: `./_lib/supabaseAdmin.js`).
- **קומפוננטות קטנות**, כל אחת בקובץ משלה.
- **פונקציית `/api` חדשה:** קובץ ב-`api/` בשם kebab-case; `getSupabaseAdmin()` + `getCallerProfile()`; בדיקת method/הרשאה/קלט; החזרת `{error}` בעברית; קריאה מהפרונטאנד עם שם ה-camelCase.

---

## 12. פיתוח, בנייה ופריסה

```bash
npm install
npm run dev        # Vite מקומי; מדבר עם Supabase האמיתי דרך .env.local
npm run build      # → dist
npm run lint       # eslint . --quiet
npm run typecheck  # tsc -p jsconfig.json
```
- **הערה:** `npm run dev` מגיש רק את הפרונטאנד; ה-`/api/*` לא יעבוד מקומית בלי `vercel dev` (נדרש Vercel CLI + משתני סביבה). בלי זה: הגשת בקשת גישה, פעולות משיכה והזמנת משתמשים ייכשלו.
- **DB:** הרצת migrations לפי הסדר `0001` → `0001a` → `0002` → `0003` ב-SQL Editor של Supabase (או `supabase db push`). שינוי סכמה = קובץ migration חדש ממוספר; לא לערוך קיימים.
- **פריסה:** דחיפה ל-GitHub → Vercel (Vite מזוהה אוטומטית, `/api` נקלט אוטומטית). ארבעת משתני הסביבה (§3.3) חייבים להיות מוגדרים ב-Vercel.
- **Google OAuth:** מוגדר ב-Supabase → Authentication → Providers; redirect URI מה-Supabase.
