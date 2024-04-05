import { ActionIcon, Box, Button, Divider, Group, NativeSelect, Slider, Switch, TextInput, Textarea, Title, Transition } from "@mantine/core"
import { useNavigate, useParams } from "react-router-dom"
import { ethers } from "ethers"
import { useForm } from "@mantine/form"
import { IconTrash } from "@tabler/icons-react"
import { NETWORKS } from "../stores/Sequence"
import { toUpperFirst } from "../Utils"
import { notifications } from "@mantine/notifications"
import { TransactionsEntry, addTransaction, subdigestOf } from "../stores/db/Transactions"
import { useEffect, useMemo, useState } from "react"
import { encodeFunctionData } from "viem"

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
        value: '',
        data: ''
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

  const fields = form.values.transactions.map((_, index) => <TxElement key={index} form={form} index={index} />)

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
        revertOnError: true
      })),
    }

    const subdigest = subdigestOf(txe)
    if(await addTransaction(txe)) {
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
            <Button variant="light" onClick={() => form.insertListItem('transactions', { to: '', value: '', data: '' })}>
              Add transaction
            </Button>
            <Button type="submit">Submit</Button>
          </Group>
        </form>
      </Box>
    </>
  );
}

type ParsedFunctionSelector = { name: string, inputs: { name?: string, type: string }[] }
function parseFunctionSelector(selector: string): ParsedFunctionSelector {
  const [name, inputs] = selector.split('(')
  if (!inputs) {
    throw new Error('Missing input arguments')
  }
  
  const inputTypes = inputs.slice(0, -1).split(',').filter((input) => input.trim() !== '')

  const res = {
    name,
    inputs: inputTypes.map((input) => {
      // Name is optional
      const parts = input.split(' ')
      if (parts.length === 1) {
        return { type: parts[0] }
      }
      
      const trimmed0 = parts[0].trim()
      const trimmed1 = parts[1].trim()

      if (trimmed0 === '') {
        return { type: trimmed1 }
      }

      if (trimmed1 === '') {
        return { type: trimmed0 }
      }

      return {
        name: trimmed0,
        type: trimmed1
      }
    })
  }

  if (res.name === '') {
    throw new Error('Empty function name')
  }

  for (const input of res.inputs) {
    if (!/^(address|uint\d+|int\d+|bool|bytes\d*|string)$/.test(input.type)) {
      throw new Error('Invalid type: ' + input.type)
    }
  }

  return res
}

export function TxElement(props: { form: any, index: number }) {
  const { form, index } = props

  const [abiEncoder, useAbiEncoder] = useState(false)
  const [functionSelector, setFunctionSelector] = useState('')
  const [functionArgs, setFunctionArgs] = useState<string[]>([])

  const [abiError, parsedSelector] = useMemo(() => {
    let abiError = ''
    let parsedSelector: ParsedFunctionSelector | undefined = undefined
  
    if (abiEncoder && functionSelector.length > 0) {
      try {
        parsedSelector = parseFunctionSelector(functionSelector)
      } catch (e) {
        abiError = (e as any)?.message?.toString()
      }
    }

    return [abiError, parsedSelector]
  }, [functionSelector])

  useEffect(() => {
    if (!abiEncoder) {
      form.setFieldValue(`transactions.${index}.data`, '')
    } else {
      form.setFieldValue(`transactions.${index}.data`, "Complete ABI Form")

      if (!parsedSelector) return

      try {
        const encoded = encodeFunctionData({
          abi: [{
            constant: false,
            outputs: [],
            name: parsedSelector.name,
            inputs: parsedSelector.inputs.map((input, index) => {
              return {
                name: input.name || index + 'Arg',
                type: input.type
              }
            }),
            payable: false,
            stateMutability: 'nonpayable',
            type: 'function',
          }],
          functionName: parsedSelector.name,
          args: functionArgs
        })

        form.setFieldValue(`transactions.${index}.data`, encoded)
      } catch (e) {
        form.setFieldValue(`transactions.${index}.data`, 'Error: ' + (e as any).message)
      }
    }
  }, [abiEncoder, parsedSelector, functionArgs])

  return <Group key={index} mt="xs" >
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
        autosize
        minRows={4}
        disabled={abiEncoder}
        {...form.getInputProps(`transactions.${index}.data`)}
      />
      <Switch
        label="Use ABI Encoder"
        checked={abiEncoder}
        onChange={() => useAbiEncoder(!abiEncoder)}
        mb="xs"
      />
      {abiEncoder && <>
        <TextInput
          label="Function selector"
          placeholder="transfer(address,address,uint256)"
          mb="xs"
          value={functionSelector}
          onChange={(event) => setFunctionSelector(event.currentTarget.value)}
          error={abiError}
        />
        {parsedSelector && parsedSelector.inputs.map((input, i) => {
          return <TextInput
            key={i}
            label={`${input.type} (${input.name || i})`}
            placeholder={input.type}
            mb="xs"
            value={functionArgs[i]}
            onChange={(event) => {
              const args = [...functionArgs]
              args[i] = event.currentTarget.value
              setFunctionArgs(args)
            }}
          />
        })
        }
      </>}
      <ActionIcon color="red" onClick={() => form.removeListItem('transactions', index)}>
        <IconTrash size="1rem" />
      </ActionIcon>
    </Box>
  </Group>
}