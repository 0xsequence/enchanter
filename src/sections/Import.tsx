import { Button, Center, Divider, Modal, Space, Textarea, Text, FileButton } from "@mantine/core"
import { ReactNode, createContext, useContext, useEffect, useState } from "react"
import { importData } from "../stores/Storage"
import { notifications } from "@mantine/notifications"

interface ImportContextType {
  opened: boolean
  open: () => void
  close: () => void
}

const ImportContext = createContext<ImportContextType | null>(null);

interface ImportProviderProps {
  children: ReactNode
}

export const ImportProvider = ({ children }: ImportProviderProps) => {
  const [opened, setOpened] = useState(false)

  const open = () => setOpened(true)
  const close = () => setOpened(false)

  const value: ImportContextType = { opened, open, close }

  return <ImportContext.Provider value={value}>
    <Import />
    {children}
  </ImportContext.Provider>
};

export const useImport = (): ImportContextType => {
  const context = useContext(ImportContext)

  if (context === null) {
    throw new Error('useImport must be used within an ImportProvider');
  }

  return context
}

export function Import() {
  const { opened, close } = useImport()

  const [data, setData] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const doImport = (data: string) => {
    try {
      const result = importData(data)
    
      if (result.importedSignatures.length === 0 && result.importedTransactions.length === 0) {
        notifications.show({
          title: 'No data imported',
          message: 'No new transactions or signatures found',
          color: 'yellow'
        })
      } else {
        if (result.importedTransactions.length > 0) {
          notifications.show({
            title: 'Transactions imported',
            message: 'Imported ' + result.importedTransactions.length + ' transactions',
            color: 'green'
          })
        }

        if (result.importedSignatures.length > 0) {
          notifications.show({
            title: 'Signatures imported',
            message: 'Imported ' + result.importedSignatures.length + ' signatures',
            color: 'green'
          })
        }
      }

      setData('')
      close()
    } catch (e) {
      notifications.show({
        title: 'Import failed',
        message: (e as any).message,
        color: 'red'
      })
    }
  }

  useEffect(() => {
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setData(event.target.result.toString())
        }
      }
      reader.readAsText(file)
    }
  }, [file])

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setData('')
        close()
      }}
      title="Import data"
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
        autosize
        onChange={(event) => setData(event.currentTarget.value)}
        value={data}
      />
      <Space h="md" />
      <Divider />
      <Space h="md" />
      <Center>
        <Button onClick={() => doImport(data)} disabled={data === ""}>Import</Button>
        <Text m="md">or</Text>
        <FileButton onChange={setFile} accept="json">
          {(props) => <Button {...props} variant="outline">Import File</Button> }
        </FileButton>
      </Center>
    </Modal>
  )
}
