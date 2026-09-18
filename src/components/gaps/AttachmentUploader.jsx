import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, X, Paperclip, Film } from "lucide-react";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

const MAX_VIDEO_MB = 25;

function detectType(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export default function AttachmentUploader({ value = [], onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    setError("");
    const valid = [];
    for (const f of files) {
      const type = detectType(f);
      if (!type) {
        setError("ניתן לצרף רק תמונות או סרטונים");
        continue;
      }
      if (type === "video" && f.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(`סרטונים מוגבלים עד ${MAX_VIDEO_MB}MB`);
        continue;
      }
      valid.push({ file: f, type });
    }
    if (!valid.length) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        valid.map(async ({ file, type }) => {
          const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
          return { url: file_url, type, name: file.name };
        })
      );
      onChange([...(value || []), ...uploaded]);
    } catch (err) {
      setError("שגיאה בהעלאת קובץ");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (idx) => {
    onChange((value || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        {uploading ? "מעלה..." : "צרף תמונה/סרטון"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {(value || []).length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((att, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              {att.type === "image" ? (
                <Image src={att.url} alt={att.name || ""} fittingType="fill" className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                  <Film className="w-6 h-6 text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-1 left-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}