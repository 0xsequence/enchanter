
import { Button, Group, Modal, Textarea, Text } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { useExport } from "../hooks/Export"

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
      <Text fz="sm" c="dimmed" mb="sm">
        Share this payload with other signers so they can import it.
      </Text>
      <Textarea
        minRows={8}
        maxRows={16}
        readOnly
        autosize
        styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 13 } }}
        value={content}
      />
      <Group justify="flex-end" gap="sm" mt="md">
        <Button onClick={() => downloadFile(content) } variant="default">Export File</Button>
        <Button onClick={() => copyToClipboard(content)}>Copy</Button>
      </Group>
    </Modal>
  )
}
