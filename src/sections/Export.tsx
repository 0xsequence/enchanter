
import { Button, Center, Divider, Modal, Space, Textarea, Text } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { ReactNode, createContext, useContext, useState } from "react"

interface ExportContextType {
  content: string
  open: (data: string) => void
  close: () => void
}

const ExportContext = createContext<ExportContextType | null>(null);

interface ExportProviderProps {
  children: ReactNode
}

export const ExportProvider = ({ children }: ExportProviderProps) => {
  const [data, setData] = useState("")

  const open = (data: string) => setData(data)
  const close = () => setData("")

  const value: ExportContextType = { content: data, open, close }

  return <ExportContext.Provider value={value}>
    <Export />
    {children}
  </ExportContext.Provider>
};

export const useExport = (): ExportContextType => {
  const context = useContext(ExportContext)

  if (context === null) {
    throw new Error('useExport must be used within an ExportProvider');
  }

  return context
}

export function Export() {
  const { content, close } = useExport()

  const copyToClipboard = async (data: string) => {
    try {
      await navigator.clipboard.writeText(data)
      notifications.show({
        title: 'Copied to clipboard',
        message: 'Data copied to clipboard',
        color: 'green'
      })
    } catch (err) {
      notifications.show({
        title: 'Failed to copy to clipboard',
        message: String(err),
        color: 'red'
      })
    }
  }

  const downloadFile = (data: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const date = new Date();
    const dateString = date.toISOString().split('T')[0];
    const timeString = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `sequence-enchanter-${dateString}-${timeString}.json`;
  
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
  
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      opened={content !== ""}
      onClose={() => {
        close()
      }}
      title="Export data"
      centered
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      size="lg"
    >
      <Textarea
        placeholder="Paste anything"
        minRows={10}
        readOnly
        autosize
        value={content}
      />
      <Space h="md" />
      <Divider />
      <Space h="md" />
      <Center>
        <Button onClick={() => copyToClipboard(content)}>Copy</Button>
        <Text m="md">or</Text>
        <Button onClick={() => downloadFile(content) } variant="outline">Export File</Button>
      </Center>
    </Modal>
  )
}
