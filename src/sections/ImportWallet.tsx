import { Box, Button, Center, Group, Loader, LoadingOverlay, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { ethers } from "ethers";
import { useState } from "react";
import { accountFor } from "../stores/Sequence";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { useWallets } from "../stores/db/Wallets";

export function ImportWallet() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { addWallet } = useWallets()

  const form = useForm({
    initialValues: {
      wallet: '',
      name: '',
    },
    validate: {
      wallet: (value) => {
        if (!value) {
          return 'Wallet is required';
        }

        if (!ethers.utils.isAddress(value)) {
          return 'Invalid wallet address';
        }
      },
      name: (value) => {
        if (!value) {
          return 'Name is required';
        }
      }
    }
  })

  const onSubmit = async (values: { wallet: string, name: string }) => {
    setLoading(true)

    // Attempt to fetch the status
    // this will determine if the wallet is valid
    try {
      const account = accountFor({ address: values.wallet })
      const status = await account.status(1)

      // Check that the account is not a native v1 Sequence wallet
      // those aren't supported yet
      if (status.original.version !== 2) {
        notifications.show({
          title: 'Unsupported wallet version',
          message: 'Only Sequence v2 wallets are supported',
          color: 'red',
        })
        setLoading(false)
        return
      }

      // Import wallet
      if (!(await addWallet(values.wallet, values.name))) {
        notifications.show({
          title: 'Wallet already exists',
          message: 'Wallet already imported',
          color: 'yellow',
        })
        setLoading(false)
        return
      }

      notifications.show({
        title: 'Wallet imported',
        message: 'Wallet imported successfully',
        color: 'green',
      })

      navigate('/wallet/' + values.wallet)
    } catch (e) {
      notifications.show({
        title: 'Error importing wallet',
        message: (e as any).message,
        color: 'red',
      })
      setLoading(false)
    }
  }

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
            mb="md"
          />
          <TextInput
            withAsterisk
            label="Wallet address"
            placeholder="0x..."
            {...form.getInputProps('wallet')}
            mb="md"
          />
          <Group justify="flex-end" mt="md">
            <Button type="submit">Import</Button>
          </Group>
        </form>
      </Box>
    </Box>
  );
}