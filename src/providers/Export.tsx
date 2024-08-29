import { ReactNode, createContext, useState } from "react";
import { Export } from "../sections/Export";

export interface ExportContextType {
  content: string;
  open: (data: string) => void;
  close: () => void;
}

interface ExportProviderProps {
  children: ReactNode;
}

export const ExportContext = createContext<ExportContextType | null>(null);

export const ExportProvider = ({ children }: ExportProviderProps) => {
  const [data, setData] = useState("");

  const open = (data: string) => setData(data);
  const close = () => setData("");

  const value: ExportContextType = { content: data, open, close };

  return (
    <ExportContext.Provider value={value}>
      <Export />
      {children}
    </ExportContext.Provider>
  );
};
