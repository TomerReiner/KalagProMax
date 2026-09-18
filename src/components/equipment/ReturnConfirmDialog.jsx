import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo2, Loader2 } from "lucide-react";

export default function ReturnConfirmDialog({ target, onClose, onConfirm, saving }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-amber-600" />
            אישור החזרת ציוד
          </DialogTitle>
        </DialogHeader>
        {target && (
          <p className="text-sm leading-relaxed">
            האם לאשר את החזרת <strong>{target.item_name}</strong> (×{target.quantity}) למחסן{" "}
            <strong>{target.warehouse}</strong>?
            {target.expected_return_date && (
              <span className="block text-xs text-muted-foreground mt-2">
                תאריך החזרה צפוי: {target.expected_return_date}
              </span>
            )}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={onConfirm} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
            אשר החזרה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}