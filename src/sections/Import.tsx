import { Button, Center, Divider, Modal, Space, Textarea, Text, FileButton } from "@mantine/core"
import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import { importData } from "../stores/Exporter"
import { isErrorWithMessage } from "../helpers/errors"
import { useImport } from "../hooks/Import"

export function Import() {
  const { opened, close } = useImport()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const doImport = async (data: string) => {
    try {
      if (loading) return
      setLoading(true)

      const result = await importData(data)
    
      if (
        result.importedSignatures.length === 0 &&
        result.importedMessages.length === 0 &&
        result.importedTransactions.length === 0 &&
        result.importedUpdates.length === 0
      ) {
        notifications.show({
          title: 'No data imported',
          message: 'No new transactions, signatures or messages found',
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

        if (result.importedMessages.length > 0) {
          notifications.show({
            title: 'Messages imported',
            message: 'Imported ' + result.importedMessages.length + ' messages',
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

        if (result.importedUpdates.length > 0) {
          notifications.show({
            title: 'Updates imported',
            message: 'Imported ' + result.importedUpdates.length + ' updates',
            color: 'green'
          })
        }
      }

      setData('')
      close()
      setLoading(false)
    } catch (error) {
      let errorMessage;

      if (isErrorWithMessage(error) && error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
      notifications.show({
        title: 'Import failed',
        message: errorMessage,
        color: 'red'
      })
      setLoading(false)
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
