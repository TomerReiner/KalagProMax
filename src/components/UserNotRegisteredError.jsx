import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail } from 'lucide-react';

const UserNotRegisteredError = () => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.functions.invoke("submitAccessRequest", { email, full_name: fullName });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "שגיאה בשליחת הבקשה");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50" dir="rtl">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-green-100">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">הבקשה נשלחה!</h1>
            <p className="text-slate-600 mb-6">
              בקשתך התקבלה וממתינה לאישור מנהל. תקבל הזמנה לאימייל לאחר אישור.
            </p>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              חזרה למסך הכניסה
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 px-4" dir="rtl">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">הגישה מוגבלת</h1>
          <p className="text-slate-600 text-sm">
            אינך רשום במערכת. שלח בקשת גישה ומנהל המערכת יאשר אותה.
          </p>
        </div>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="error-email">אימייל</Label>
            <Input
              id="error-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="error-name">שם מלא (אופציונלי)</Label>
            <Input
              id="error-name"
              type="text"
              placeholder="שם מלא"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שולח...
              </>
            ) : (
              "שלח בקשת גישה"
            )}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={handleLogout} className="text-sm text-slate-500 hover:underline">
            חזרה למסך הכניסה
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;