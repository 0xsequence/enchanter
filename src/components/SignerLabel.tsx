import { ActionIcon, Group, Text, TextInput, Tooltip } from "@mantine/core"
import { IconCheck, IconPencil, IconX } from "@tabler/icons-react"
import { ethers } from "ethers"
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react"
import { nameForAddress } from "../Names"
import { MAX_ADDRESS_LABEL_LENGTH } from "../stores/db/AddressLabels"

type SignerLabelProps = {
  address: string
  label?: string
  onSave?: (label: string) => Promise<void>
}

export function SignerLabel({ address, label, onSave }: SignerLabelProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const savingRef = useRef(false)

  const fallback = ethers.isAddress(address) ? nameForAddress(address) : address
  const displayLabel = label || fallback
  const canEdit = Boolean(onSave)

  useEffect(() => {
    if (editing && !dirty) {
      setValue(label || "")
    }
  }, [dirty, editing, label])

  const startEditing = () => {
    setValue(label || "")
    setDirty(false)
    setError(undefined)
    setEditing(true)
  }

  const cancelEditing = () => {
    if (savingRef.current) return

    setEditing(false)
    setDirty(false)
    setError(undefined)
  }

  const save = async () => {
    if (!onSave || savingRef.current) return

    savingRef.current = true
    setSaving(true)
    setError(undefined)
    try {
      await onSave(value)
      setEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save label")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void save()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      if (!savingRef.current) {
        cancelEditing()
      }
    }
  }

  if (editing) {
    return <form onSubmit={onSubmit}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          aria-label={`Label for ${address}`}
          autoFocus
          disabled={saving}
          error={error}
          maxLength={MAX_ADDRESS_LABEL_LENGTH}
          onChange={(event) => {
            setDirty(true)
            setValue(event.currentTarget.value)
          }}
          onKeyDown={onKeyDown}
          placeholder={fallback}
          value={value}
          style={{ flex: 1, minWidth: 160 }}
        />
        <Tooltip label="Save label">
          <ActionIcon aria-label="Save label" type="submit" disabled={saving} loading={saving} variant="light">
            <IconCheck size="1rem" />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Cancel label edit">
          <ActionIcon aria-label="Cancel label edit" type="button" disabled={saving} onClick={cancelEditing} variant="subtle">
            <IconX size="1rem" />
          </ActionIcon>
        </Tooltip>
      </Group>
    </form>
  }

  if (!canEdit) {
    return <Text span className="signer-label" fw={label ? 600 : undefined}>{displayLabel}</Text>
  }

  return <Group gap={4} wrap="nowrap">
    <Text span className="signer-label" fw={label ? 600 : undefined}>{displayLabel}</Text>
    <Tooltip label={label ? "Edit signer label" : "Add signer label"}>
      <ActionIcon
        aria-label={`${label ? "Edit" : "Add"} label for ${address}`}
        onClick={startEditing}
        size="sm"
        type="button"
        variant="subtle"
      >
        <IconPencil size="0.9rem" />
      </ActionIcon>
    </Tooltip>
  </Group>
}
