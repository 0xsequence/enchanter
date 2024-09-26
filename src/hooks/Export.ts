import { useContext } from "react";
import { ExportContext, ExportContextType } from "../providers/Export";

export const useExport = (): ExportContextType => {
  const context = useContext(ExportContext);

  if (context === null) {
    throw new Error("useExport must be used within an ExportProvider");
  }

  return context;
};
