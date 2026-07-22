import { Box, Button, Center, Divider, Group, Loader, LoadingOverlay, NativeSelect, NumberInput, TextInput, Tooltip } from "@mantine/core";
import { Page, PageHeader } from "../components/Page";
import { useForm } from "@mantine/form";
import { notifications } from '@mantine/notifications';
import { createSequenceWallet } from "../stores/Sequence";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallets } from "../stores/db/Wallets";
import { SignerEditor, SignerEditorEntry, SignerEditorValidator } from "../components/SignerEditor";
import { isErrorWithMessage } from "../helpers/errors";

export function Create() {
  const { addWallet } = useWallets()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const form = useForm({
    initialValues: {
      name: '',
      version: '3',
      threshold: 0,
      salt: undefined as (number | undefined),
      signers: [{
        address: '',
        weight: 0
      }] as SignerEditorEntry[],
    },

    validate: {
      name: (value) => {
        if (!value) {
          return 'Name is required';
        }

        return value.length > 1024 ? 'Name should be less than 1024 characters' : null;
      },
      threshold: (value) => {
        if (value === null) {
          return 'Threshold is required';
        }

        if (value < 1) {
          return 'Threshold should be greater than 0';
        }

        return value > 65535 ? 'Threshold should be less than 65535' : null;
      },
      salt: (value) => {
        if (value) {
          // Must be a number between 0 and 2147483647
          if (value < 0 || value > 2147483647) {
            return 'Salt should be between 0 and 2147483647';
          }
        }
      },
      signers: SignerEditorValidator()
    },
  });

  const onSubmit = async (values: {
    threshold: number,
    signers?: {
      address: string, weight: number
    }[],
    salt?: number,
    name: string
    version: string
  }) => {
    if (values.signers === undefined) return
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
  
    // Open a new wallet
    try {
      const version = Number(values.version) as 2 | 3
      const address = await createSequenceWallet(values.threshold, values.signers, values.salt, version);
      console.log('New wallet address:', address);

      // Attempt to save the wallet address
      if (await addWallet(address, values.name, version)) {
        // TODO: Redirect
        notifications.show({
          title: 'Wallet created',
          message: address + ' created successfully',
          color: 'green',
        });
        navigate('/wallet/' + address)
      } else {
        notifications.show({
          title: 'Wallet already exists',
          message: address + ' already exists',
          color: 'red',
        });
      }
    } catch (error) {
      let errorMessage;

      if (isErrorWithMessage(error) && error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }

      notifications.show({
        title: 'Failed to create wallet',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Create wallet"
        description="Deploy a new Sequence multisig. Pick a threshold and the set of signers allowed to approve operations."
      />
      <Box maw={640} pos="relative" className="panel panel-padded">
        <form onSubmit={form.onSubmit((values) => onSubmit(values))}>
          <LoadingOverlay visible={loading} loaderProps={{ children: <Center>
            <Loader size={30} mr="md" />
            Creating wallet...
          </Center> }}> </LoadingOverlay>
          <TextInput
            withAsterisk
            label="Name (local only)"
            placeholder="My wallet"
            {...form.getInputProps('name')}
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
          <NativeSelect
            withAsterisk
            label="Sequence protocol"
            description="Applies only to this new wallet; existing wallets are not migrated"
            data={[
              { value: '3', label: 'Sequence v3' },
              { value: '2', label: 'Sequence v2' },
            ]}
            mt="md"
            {...form.getInputProps('version')}
          />
          <Tooltip
            offset={{ mainAxis: 10, crossAxis: 50 }}
            arrowPosition="side" arrowSize={4}
            withArrow
            label="Allows creating multiple wallets with the same initial configuration"
          >
            <NumberInput
              label="Salt"
              placeholder="Auto"
              min={0}
              max={2147483647}
              mt="md"
              {...form.getInputProps('salt')}
            />
          </Tooltip>
          <Divider my="md" />
          <SignerEditor form={form} formKey="signers" />
          <Divider my="md" />
          <Group justify="flex-end" mt="md">
            <Button type="submit">Create</Button>
          </Group>
        </form>
      </Box>
    </Page>
  );
}
