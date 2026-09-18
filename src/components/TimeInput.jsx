import React from "react";
import { Input } from "@/components/ui/input";

export default function TimeInput({ value, onChange }) {
  const handleChange = (e) => {
    let val = e.target.value.replace(/[^\d:]/g, "");
    if (val.length === 2 && !val.includes(":")) {
      val = val + ":";
    }
    onChange(val);
  };

  return (
    <Input
      type="text"
      value={value || ""}
      onChange={handleChange}
      placeholder="HH:MM"
      maxLength={5}
      dir="ltr"
    />
  );
}