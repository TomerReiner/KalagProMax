import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Film, Play } from "lucide-react";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

export default function AttachmentGallery({ attachments = [], size = "sm" }) {
  const [active, setActive] = useState(null);

  if (!attachments || attachments.length === 0) return null;

  const thumbCls = size === "sm" ? "w-12 h-12" : "w-full aspect-square";

  return (
    <>
      <div className={cn("flex gap-2 flex-wrap", size === "sm" && "mt-1")}>
        {attachments.map((att, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActive(att);
            }}
            className={cn(
              "relative rounded-lg overflow-hidden border border-border bg-muted shrink-0",
              thumbCls,
              size === "lg" && "max-w-[150px]"
            )}
          >
            {att.type === "image" ? (
              <Image src={att.url} alt={att.name || ""} fittingType="fill" className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <Film className="w-5 h-5 text-white" />
                <Play className="absolute w-5 h-5 text-white/80" />
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-[680px] p-2" dir="rtl">
          <DialogTitle className="sr-only">צפייה בקובץ מצורף</DialogTitle>
          {active?.type === "image" && (
            <Image src={active.url} alt={active.name || ""} fittingType="fit" className="w-full max-h-[80vh] rounded-md" />
          )}
          {active?.type === "video" && (
            <video src={active.url} controls className="w-full max-h-[80vh] rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}