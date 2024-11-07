import { ActionIcon, Button, Group, NumberInput, TextInput } from "@mantine/core";
import { UseFormReturnType } from "@mantine/form";
import { IconTrash } from "@tabler/icons-react";
import { ethers } from "ethers";

export type SignerEditorEntry = {
  address: string,
  weight: number,
}

export type SignerEditorProps<T> = {
  form: UseFormReturnType<T>,
  formKey: "signers"
}

export type FormValues = {
  signers: SignerEditorEntry[],
}

export function SignerEditorValidator() {
  return {
    address: (value: string) => {
      if (!value) {
        return 'Address is required';
      }

      return ethers.isAddress(value) ? null : 'Invalid address';
    },
    weight: (value: number) => {
      if (value === null) {
        return 'Weight is required';
      }

      if (value > 255) {
        return 'Weight should be less than 256';
      }

      return value < 0 ? 'Weight should be greater than 0' : null;
    },
  }
}

export function SignerEditor<T>(props: SignerEditorProps<T>) {
  const { form, formKey } = props
  const values = form.values as FormValues

  return <>
      { (values[formKey] as SignerEditorEntry[]).map((_, index) => (
        <Group key={index+form.getInputProps(`${formKey}.${index}.address`).value.toString()+form.getInputProps(`${formKey}.${index}.weight`)?.toString()} mt="xs">
          <TextInput
            label="Address"
            placeholder="0x..."
            withAsterisk
            style={{ flex: 1, width: '390px' }}
            {...form.getInputProps(`${formKey}.${index}.address`)}
          />
          <NumberInput
            style={{ width: 80 }}
            label="Weight"
            placeholder="0"
            withAsterisk
            min={0}
            max={255}
            {...form.getInputProps(`${formKey}.${index}.weight`)}
          />
          <ActionIcon color="red" onClick={() => form.removeListItem('signers', index)}>
            <IconTrash size="1rem" />
          </ActionIcon>
        </Group>
      )) }
      <Group justify="flex-end" mt="md">
      <Button fullWidth variant="light" onClick={() => form.insertListItem(formKey, { address: '', weight: 0 })}>
        Add signer
      </Button>
    </Group>
  </>
}
