import { Box, Button, Center, Divider, Group, Loader, LoadingOverlay, NumberInput, TextInput } from "@mantine/core"
import { Page, PageHeader } from "../components/Page"
import { useForm } from "@mantine/form"
import { ethers } from "ethers"
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { UnifiedAccountState, updateAccount, useAccountState } from "../stores/Sequence"
import { SignerEditor, SignerEditorEntry, SignerEditorValidator } from "../components/SignerEditor"
import { addUpdate } from "../stores/db/Updates"
import { notifications } from "@mantine/notifications"
import { UpdateDiff } from "../components/UpdateDiff"
import { isErrorWithMessage } from "../helpers/errors"
import { postV2UpdateToMailbox } from "../stores/Mailbox"

export function Update() {
  const params = useParams<{ address: string }>()
  const address = params.address

  const title = <PageHeader
    title="Update Signers"
    description="Propose a new signer configuration. It becomes active once enough signers approve it."
  />

  const { loading, state, error } = useAccountState(address)

  if (!address || !ethers.isAddress(address)) {
    return <Page>
      {title}
      Invalid address
    </Page>
  }

  return <Page>
    {title}
    { loading && <Loader /> }
    { !loading && state && <UpdateLoaded address={address} state={state} /> }
    { !loading && error && <div>Error: {error}</div> }
  </Page>
}

export function UpdateLoaded(props: {
  address: string,
  state: UnifiedAccountState
}) {
  const { address, state } = props
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { initialSigners, initialThreshold } = useMemo(() => {
    return {
      initialSigners: state.signers,
      initialThreshold: state.threshold
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
    
    // See if the sum of signers weights is greater than the threshold
    const totalWeight = values.signers.reduce((acc, item) => acc + item.weight, 0);
    if (totalWeight < values.threshold) {
      notifications.show({
        title: 'Invalid configuration',
        message: 'Sum of signers weights should be greater than or equal to threshold',
        color: 'red',
      });
      return;
    }

    setLoading(true)

    try {
      const { imageHash } = await updateAccount({
        address,
        threshold: values.threshold,
        signers: values.signers,
        version: state.version
      })

      const update = await addUpdate({
        wallet: address,
        imageHash,
        version: state.version,
      })

      const { isNew, subdigest } = update

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

      if (state.version === 2) {
        try {
          await postV2UpdateToMailbox(update)
        } catch (error) {
          notifications.show({
            title: 'Portable link not published',
            message: 'The update was created locally. Publication will retry automatically on the detail page.',
            color: 'yellow',
          })
          console.warn("Update: failed to publish v2 portable link", error)
        }
      }

      navigate(`/do-update/${subdigest}`)
    } catch (err) {
      notifications.show({
        title: 'Failed to create update',
        message: isErrorWithMessage(err) ? err.message : JSON.stringify(err),
        color: 'red'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box pos="relative">
      <Box maw={640} className="panel panel-padded">
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
