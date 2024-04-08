import { AccountStatus } from "@0xsequence/account"
import { Box, Button, Center, Divider, Group, Loader, LoadingOverlay, NumberInput, TextInput, Title } from "@mantine/core"
import { useForm } from "@mantine/form"
import { ethers } from "ethers"
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { updateAccount, useAccountState } from "../stores/Sequence"
import { SignerEditor, SignerEditorEntry, SignerEditorValidator } from "../components/SignerEditor"
import { universal } from "@0xsequence/core"
import { addUpdate } from "../stores/db/Updates"
import { notifications } from "@mantine/notifications"
import { UpdateDiff } from "../components/UpdateDiff"

export function Update() {
  const params = useParams<{ address: string }>()
  const address = params.address

  const title = <>
    <Title order={3} mb="md">Update Signers</Title>
  </>

  if (!address || !ethers.utils.isAddress(address)) {
    return <>
      {title}
      Invalid address
    </>
  }

  const { loading, state, error } = useAccountState(address)

  return <>
    {title}
    { loading && <Loader /> }
    { !loading && state && <UpdateLoaded address={address} state={state} /> }
    { !loading && error && <div>Error: {error}</div> }
  </>
}

export function UpdateLoaded(props: {
  address: string,
  state: AccountStatus
}) {
  const { address, state } = props
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { initialSigners, initialThreshold } = useMemo(() => {
    const coder = universal.genericCoderFor(state.config.version).config
    return {
      initialSigners: coder.signersOf(state.config),
      initialThreshold: (state.config as any).threshold || 0
    }
  }, [state])
  
  const form = useForm({
    validateInputOnChange: true,

    initialValues: {
      threshold: initialThreshold,
      signers: initialSigners as SignerEditorEntry[],
    },

    validate: {
      threshold: (value) => {
        if (value === null) {
          return 'Threshold is required';
        }

        if (value < 1) {
          return 'Threshold should be greater than 0';
        }

        return value > 65535 ? 'Threshold should be less than 65535' : null;
      },
      signers: SignerEditorValidator()
    },
  })

  const onSubmit  = async (values: { threshold: number, signers: SignerEditorEntry[] }) => {
    if (loading) return
    setLoading(true)

    try {
      const { imageHash } = await updateAccount({
        address,
        threshold: values.threshold,
        signers: values.signers
      })

      const { isNew, subdigest } = await addUpdate({
        wallet: address,
        imageHash
      })
      
      if (!isNew) {
        notifications.show({
          title: 'Update already exists',
          message: imageHash,
          color: 'yellow'
        })
      }
      
      notifications.show({
        title: 'Update created',
        message: imageHash,
        color: 'green'
      })

      navigate(`/transaction/${subdigest}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box pos="relative">
      <Box maw={600}>
        <form onSubmit={form.onSubmit((values) => onSubmit(values))}>
          <LoadingOverlay visible={loading} loaderProps={{ children: <Center>
            <Loader size={30} mr="md" />
            Creating update operation...
          </Center> }}> </LoadingOverlay>
          <TextInput
            label="Wallet"
            value={address}
            style={{
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            mb="md"
            readOnly
          />
          <NumberInput
            withAsterisk
            label="Threshold"
            placeholder="1"
            min={1}
            max={65535}
            mt="md"
            {...form.getInputProps('threshold')}
          />
          <Divider my="md" />
          <SignerEditor form={form} formKey="signers" />
          <Divider my="md" />
          <UpdateDiff
            from={{ threshold: initialThreshold, signers: initialSigners }}
            to={form.values}
          />
          <Group justify="flex-end" mt="md">
            <Button type="submit">Update</Button>
          </Group>
        </form>
      </Box>
    </Box>
  );
}