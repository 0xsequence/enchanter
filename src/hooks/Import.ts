import { useContext } from "react";
import { ImportContextType, ImportContext } from "../providers/Import";

export const useImport = (): ImportContextType => {
  const context = useContext(ImportContext);

  if (context === null) {
    throw new Error("useImport must be used within an ImportProvider");
  }

  return context;
};
