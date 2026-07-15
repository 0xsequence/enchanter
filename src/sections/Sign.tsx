import {
  Box,
  Space,
  Title,
  TextInput,
  NativeSelect,
  Button,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "@mantine/form";
import { NETWORKS, useAccountState, v3PayloadHash, v3WalletFor } from "../stores/Sequence";
import { ethers } from "ethers";
import { toUpperFirst } from "../Utils";
import { addMessage } from "../stores/db/Messages";
import { commons } from "@0xsequence/core";

export function Sign() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const navigate = useNavigate()

  const title = (
    <>
      <Title order={3} mb="md">
        Sign Message
      </Title>
    </>
  );

  const form = useForm({
    initialValues: {
      network: "Select network",
      message: "",
    },
  });

  const network = NETWORKS.find(
    (n) => toUpperFirst(n.name) === form.values.network
  );
  const accountState = useAccountState(address, network?.chainId || 1)

  if (!address || !ethers.isAddress(address)) {
    return (
      <>
        {title}
        Invalid address
      </>
    );
  }

  const onSubmit = async (values: { message: string }) => {
    if (!network) return;

    const digest = ethers.hashMessage(values.message);
    if (!accountState.state) return
    const subdigest = accountState.state.version === 3
      ? v3PayloadHash(
        address,
        network.chainId,
        (await v3WalletFor(address).prepareMessageSignature(values.message, network.chainId)).payload
      )
      : commons.signature.subdigestOf({digest, chainId: network.chainId, address})

    await addMessage({version: accountState.state.version, raw: values.message, chainId: network.chainId, subdigest, wallet: address, digest, firstSeen: Date.now()})
      
    navigate('/message/' + subdigest)
  };

  return (
    <>
      {title}
      <Space h="xs" />
      <Box maw={600}>
        <form onSubmit={form.onSubmit((values) => onSubmit({ ...values }))}>
          <TextInput
            label="Message"
            mb="md"
            {...form.getInputProps("message")}
          />

          <NativeSelect
            label="Network"
            data={[
              "Select network",
              ...NETWORKS.sort((a, b) => a.chainId - b.chainId).map((n) =>
                toUpperFirst(n.name)
              ),
            ]}
            value={form.values.network}
            onChange={(event) =>
              form.setFieldValue("network", event.target.value)
            }
            mb="md"
          />
          <Button type="submit" disabled={!accountState.state}>Submit</Button>
        </form>
      </Box>
    </>
  );
}
