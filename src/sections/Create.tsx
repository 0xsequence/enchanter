import { ActionIcon, Box, Button, Center, Divider, Group, Loader, LoadingOverlay, NumberInput, TextInput, Title, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { randomId } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import { ethers } from "ethers";
import { notifications } from '@mantine/notifications';
import { createSequenceWallet } from "../stores/Sequence";
import { addWallet } from "../stores/Storage";
import { useState } from "react";
import { useNavigate } from "react-router-dom";


export function Create() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const form = useForm({
    initialValues: {
      name: '',
      threshold: 0,
      nonce: undefined as (number | undefined),
      signers: [{ address: '', weight: 1, key: randomId() }],
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
      nonce: (value) => {
        if (value) {
          // Must be a number between 0 and 4294967295
          if (value < 0 || value > 4294967295) {
            return 'Nonce should be between 0 and 4294967295';
          }
        }
      },
      signers: {
        address: (value) => {
          if (!value) {
            return 'Address is required';
          }

          return ethers.utils.isAddress(value) ? null : 'Invalid address';
        },
        weight: (value) => {
          if (value === null) {
            return 'Weight is required';
          }

          if (value > 255) {
            return 'Weight should be less than 256';
          }

          return value < 0 ? 'Weight should be greater than 0' : null;
        },
      }
    },
  });

  const onSubmit = async (values: { threshold: number, signers: { address: string, weight: number }[], nonce: number | undefined, name: string }) => {
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
      const address = await createSequenceWallet(values.threshold, values.signers, values.nonce);
      console.log('New wallet address:', address);

      // Attempt to save the wallet address
      if (addWallet(address, values.name)) {
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
    } catch (error: any) {
      notifications.show({
        title: 'Failed to create wallet',
        message: error,
        color: 'red',
      });
    } finally {
      setLoading(false)
    }
  }

  const fields = form.values.signers.map((item, index) => (
    <Group key={item.key} mt="xs">
      <TextInput
        label="Address"
        placeholder="0x..."
        withAsterisk
        style={{ flex: 1, width: '390px' }}
        {...form.getInputProps(`signers.${index}.address`)}
      />
      <NumberInput
        style={{ width: 80 }}
        label="Weight"
        placeholder="0"
        withAsterisk
        min={0}
        max={255}
        {...form.getInputProps(`signers.${index}.weight`)}
      />
      <ActionIcon color="red" onClick={() => form.removeListItem('signers', index)}>
        <IconTrash size="1rem" />
      </ActionIcon>
    </Group>
  ));

  return (
    <Box pos="relative">
      <Title order={3} mb="md">Create wallet</Title>
      <Box maw={600}>
        <LoadingOverlay visible={loading} loaderProps={{ children: <Center>
          <Loader size={30} mr="md" />
          Creating wallet...
        </Center> }} />
        <form onSubmit={form.onSubmit((values) => onSubmit(values))}>
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
          <Tooltip
            offset={{ mainAxis: 10, crossAxis: 50 }}
            arrowPosition="side" arrowSize={4}
            withArrow
            label="Allows creating multiple wallets with the same initial configuration"
          >
            <NumberInput
              label="Nonce"
              placeholder="Auto"
              min={0}
              max={4294967295}
              mt="md"
              {...form.getInputProps('nonce')}
            />
          </Tooltip>
          <Divider my="md" />
          {fields}
          <Group justify="flex-end" mt="md">
            <Button fullWidth variant="light" onClick={() => form.insertListItem('signers', { address: '' })}>
              Add signer
            </Button>
          </Group>
          <Divider my="md" />
          <Group justify="flex-end" mt="md">
            <Button type="submit">Create</Button>
          </Group>
        </form>
      </Box>
    </Box>
  );
}