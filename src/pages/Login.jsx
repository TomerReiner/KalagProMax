import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

const LOGO_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/98fcd8299_image.png";
const HEADER_IMAGE_URL = "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/a3148ebb9_image.png";

export default function Login() {
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessName, setAccessName] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSuccess, setAccessSuccess] = useState(false);
  const [accessError, setAccessError] = useState("");
  const returnTo = safeReturnTo();

  const handleAccessRequest = async (e) => {
    e.preventDefault();
    setAccessError("");
    setAccessLoading(true);
    try {
      await base44.functions.invoke("submitAccessRequest", {
        email: accessEmail,
        full_name: accessName,
      });
      setAccessSuccess(true);
    } catch (err) {
      setAccessError(err.response?.data?.error || err.message || "שגיאה בשליחת הבקשה");
    } finally {
      setAccessLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", returnTo);
  };

  return (
    <AuthLayout
      imageUrl={LOGO_URL}
      titleImage={HEADER_IMAGE_URL}
      subtitle="התחברות למערכת"
      footer={
        <button
          onClick={() => { setAccessOpen(true); setAccessSuccess(false); setAccessError(""); }}
          className="text-primary hover:underline font-medium"
        >
          בקשת גישה חדשה
        </button>
      }
    >
      <Button
        className="w-full h-12 text-sm font-medium"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        המשך עם Google
      </Button>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          {accessSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-bold mb-2">הבקשה נשלחה!</h2>
              <p className="text-sm text-muted-foreground mb-4">
                בקשתך התקבלה וממתינה לאישור מנהל. תקבל הזמנה לאימייל לאחר אישור.
              </p>
              <Button onClick={() => setAccessOpen(false)} className="w-full">סגירה</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>בקשת גישה למערכת</DialogTitle>
              </DialogHeader>
              {accessError && (
                <div className="mb-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {accessError}
                </div>
              )}
              <form onSubmit={handleAccessRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="access-email">אימייל</Label>
                  <Input
                    id="access-email"
                    type="email"
                    placeholder="you@example.com"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="access-name">שם מלא (אופציונלי)</Label>
                  <Input
                    id="access-name"
                    type="text"
                    placeholder="שם מלא"
                    value={accessName}
                    onChange={(e) => setAccessName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAccessOpen(false)}>
                    ביטול
                  </Button>
                  <Button type="submit" disabled={accessLoading}>
                    {accessLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        שולח...
                      </>
                    ) : (
                      "שלח בקשה"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}