import {
  Box,
  Group,
  TextInput,
  NativeSelect,
  Button,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "@mantine/form";
import { NETWORKS, useAccountState, v3PayloadHash, v3WalletFor } from "../stores/Sequence";
import { ethers } from "ethers";
import { toUpperFirst } from "../Utils";
import { addMessage, MessageEntry } from "../stores/db/Messages";
import { publishMessage } from "../stores/KeyMachine";
import { commons } from "@0xsequence/core";
import { Page, PageHeader } from "../components/Page";

export function Sign() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const navigate = useNavigate()

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
      <Page>
        <PageHeader title="Sign Message" />
        Invalid address
      </Page>
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

    const entry: MessageEntry = {version: accountState.state.version, raw: values.message, chainId: network.chainId, subdigest, wallet: address, digest, firstSeen: Date.now()}
    if (await addMessage(entry)) {
      publishMessage(entry)
    }

    navigate('/message/' + subdigest)
  };

  return (
    <Page>
      <PageHeader
        title="Sign Message"
        description="Stage a message so wallet signers can co-sign it off-chain."
        meta={address}
      />
      <Box maw={640} className="panel panel-padded">
        <form onSubmit={form.onSubmit((values) => onSubmit({ ...values }))}>
          <TextInput
            label="Message"
            placeholder="The message to sign"
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
          <Group justify="flex-end" mt="md">
            <Button type="submit" disabled={!accountState.state}>Submit</Button>
          </Group>
        </form>
      </Box>
    </Page>
  );
}
