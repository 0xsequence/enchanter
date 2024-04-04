import { ActionIcon, Box, Button, Center, Divider, Group, NativeSelect, TextInput, Textarea, Title } from "@mantine/core"
import { useNavigate, useParams } from "react-router-dom"
import { TransactionsEntry, addTransaction, subdigestOf } from "../stores/Storage"
import { ethers } from "ethers"
import { useForm } from "@mantine/form"
import { IconTrash } from "@tabler/icons-react"
import { NETWORKS } from "../stores/Sequence"
import { toUpperFirst } from "../Utils"
import { notifications } from "@mantine/notifications"

type TransactionRequest = {
  to: string
  value: string | undefined
  data: string | undefined
}

export function Send() {
  const params = useParams<{ address: string }>()
  const address = params.address
  const navigate = useNavigate()

  const title = <>
    <Title order={3} mb="md">Send Transaction</Title>
  </>

  if (!address || !ethers.utils.isAddress(address)) {
    return <>
      {title}
      Invalid address
    </>
  }

  const form = useForm({
    initialValues: {
      network: 'Select network',
      transactions: [{
        to: '',
      }] as TransactionRequest[],
    },

    validate: {
      transactions: {
        to: (value: string) => {
          if (!value) {
            return 'To is required';
          }

          return ethers.utils.isAddress(value) ? null : 'Invalid address';
        },
        value: (value) => {
          if (value) {
            try {
              ethers.BigNumber.from(value);
            } catch (e) {
              return 'Value should be a number';
            }
          }
        },
        data: (value) => {
          if (value) {
            try {
              ethers.utils.arrayify(value)
            } catch (e) {
              return 'Data should be a hex string';
            }
          }
        }
      }
    },
  });

  const fields = form.values.transactions.map((_, index) => (
    <Group key={index} mt="xs">
      <Box style={{ width: "100%" }}>
        <Divider mt="xs" mb="xs" label={"Transaction " + index} />
        <TextInput
          label="To"
          placeholder="0x..."
          withAsterisk
          mb="xs"
          {...form.getInputProps(`transactions.${index}.to`)}
        />
        <TextInput
          label="Value (wei)"
          placeholder="0"
          mb="xs"
          {...form.getInputProps(`transactions.${index}.value`)}
        />
        <Textarea
          label="Data"
          placeholder="0x..."
          mb="xs"
          {...form.getInputProps(`transactions.${index}.data`)}
        />
        <ActionIcon color="red" onClick={() => form.removeListItem('transactions', index)}>
          <IconTrash size="1rem" />
        </ActionIcon>
      </Box>
    </Group>
  ));

  const onSubmit  = async (values: { network: string, transactions: TransactionRequest[], space?: ethers.BigNumberish, nonce: ethers.BigNumberish }) => {
    const network = NETWORKS.find(n => toUpperFirst(n.name) === values.network)
    if (!network) {
      return
    }
    
    const txe: TransactionsEntry = {
      wallet: address,
      space: ethers.BigNumber.from(values.space || Math.floor(Date.now())).toString(),
      nonce: ethers.BigNumber.from(values.nonce).toString(),
      chainId: network.chainId.toString(),
      transactions: values.transactions.map(t => ({
        to: t.to,
        value: ethers.BigNumber.from(t.value || '0').toString(),
        data: t.data ? ethers.utils.hexlify(t.data) : undefined,
      })),
    }

    const subdigest = subdigestOf(txe)
    if(addTransaction(txe)) {
      notifications.show({
        title: 'Transaction created',
        message: subdigest + ' added',
        color: 'green',
      })
      navigate('/transaction/' + subdigest)
    } else {
      notifications.show({
        title: 'Transaction already exists',
        message: subdigest + ' already exists',
        color: 'red',
      })
    }
  }

  return (
    <>
      {title}
      <Box maw={600}>
        <form onSubmit={form.onSubmit((values) => onSubmit({ ...values, nonce: 0 }))}>
          <TextInput
            label="From"
            value={address}
            style={{
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            mb="md"
            readOnly
          />

          <NativeSelect
            label="Network"
            data={["Select network", ...NETWORKS.sort((a, b) => a.chainId - b.chainId).map(n => toUpperFirst(n.name))]}
            value={form.values.network}
            onChange={(event) => form.setFieldValue('network', event.target.value)}
          />

          {fields}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => form.insertListItem('transactions', { to: '' })}>
              Add transaction
            </Button>
            <Button type="submit">Submit</Button>
          </Group>
        </form>
      </Box>
    </>
  );
}
