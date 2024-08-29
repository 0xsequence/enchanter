import { ReactNode, createContext, useState } from "react";
import { Import } from "../sections/Import";

export interface ImportContextType {
  opened: boolean;
  open: () => void;
  close: () => void;
}

export const ImportContext = createContext<ImportContextType | null>(null);

interface ImportProviderProps {
  children: ReactNode;
}

export const ImportProvider = ({ children }: ImportProviderProps) => {
  const [opened, setOpened] = useState(false);

  const open = () => setOpened(true);
  const close = () => setOpened(false);

  const value: ImportContextType = { opened, open, close };

  return (
    <ImportContext.Provider value={value}>
      <Import />
      {children}
    </ImportContext.Provider>
  );
};
