import { createContext, useContext, useState } from "react";

const PreviewRoleContext = createContext(null);

export function PreviewRoleProvider({ children }) {
  const [previewRole, setPreviewRole] = useState(null);
  const [previewPluga, setPreviewPluga] = useState(null);
  return (
    <PreviewRoleContext.Provider value={{ previewRole, setPreviewRole, previewPluga, setPreviewPluga }}>
      {children}
    </PreviewRoleContext.Provider>
  );
}

export function usePreviewRole() {
  return useContext(PreviewRoleContext);
}