import {
  Box,
  Space,
  Title,
  Button,
  Loader,
  Grid,
  Tooltip,
  Divider,
} from "@mantine/core";
import { MiniCard } from "../components/MiniCard";
import { AccountStatus } from "@0xsequence/account";
import { universal } from "@0xsequence/core";
import { useParams } from "react-router-dom";
import { accountFor, useAccountState, useRecovered } from "../stores/Sequence";
import { useSignatures, addSignature } from "../stores/db/Signatures";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Signatures } from "../components/Signatures";
import { MessageEntry, useMessage } from "../stores/db/Messages";
import { ethers } from "ethers";

export function Message() {
  const { subdigest } = useParams<{ subdigest: string }>();

  const title = (
    <>
      <Title order={3} mb="md">
        Message Detail
      </Title>
    </>
  );

  if (!subdigest) {
    return (
      <>
        {title}
        Invalid message
      </>
    );
  }

  const message = useMessage({ subdigest });
  const { signatures } = useSignatures({
    subdigest: ethers.utils.hexlify(
      ethers.utils.toUtf8Bytes(message?.raw ?? "")
    ),
  });
  const { loading, error, state } = useAccountState(message?.wallet);

  if (!message) {
    return (
      <>
        {title}
        Message {subdigest.toString()} not found.
      </>
    );
  }

  return (
    <>
      {title}
      <Space h="xs" />
      <Box m="md">
        <Grid grow>
          <MiniCard title="Wallet" value={message.wallet} />
          <MiniCard
            title="Message"
            value={message.raw}
            shortValue={
              message.raw.length > 64
                ? `${message.raw.slice(0, 64)}...`
                : undefined
            }
          />
          <MiniCard title="Chain ID" value={String(message.chainId)} />
        </Grid>
      </Box>
      <Space h="md" />
      <Divider />
      <Space h="md" />
      <Box>
        <Title order={5}>Stateful</Title>
        <Space h="xs" />
        {loading && <Loader />}
        {error && "Error: " + error}
        {state && !loading && (
          <StatefulMessage
            message={message}
            state={state}
            signatures={signatures.map((s) => s.signature)}
          />
        )}
      </Box>
    </>
  );
}

export function StatefulMessage(props: {
  message: MessageEntry;
  state: AccountStatus;
  signatures: string[];
}) {
  const { message, signatures, state } = props;

  const recovered = useRecovered(
    ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message.raw)),
    signatures
  );

  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const threshold = (state.config as any).threshold as number | undefined;
  if (!threshold) {
    return <Box>Threshold not found</Box>;
  }

  const coder = universal.genericCoderFor(state.config.version);

  const weightSum = coder.config
    .signersOf(state.config)
    .filter((s) => recovered.has(s.address))
    .reduce((acc, signer) => acc + signer.weight, 0);
  const progress = Math.floor((weightSum / threshold) * 100);

  let canSignError = "";
  if (address) {
    if (recovered.has(address)) {
      canSignError = "You have already signed this message";
    } else {
      const signer = coder.config
        .signersOf(state.config)
        .find((s) => s.address === address.toString());
      if (!signer) {
        canSignError = "You are not a signer of this wallet";
      }
    }
  } else {
    canSignError = "Connect your wallet to sign the message";
  }

  const [signing, setSigning] = useState(false);
  const onSign = async () => {
    setSigning(true);

    try {
      const signature = await signMessageAsync({
        message: { raw: ethers.utils.toUtf8Bytes(message.raw) },
      });

      const suffixed = signature + "02";
      notifications.show({
        title: "Message signed",
        message: "Message signed successfully",
        color: "green",
      });

      await addSignature({
        subdigest: ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message.raw)),
        signature: suffixed,
      });
    } catch (error: any) {
      notifications.show({
        title: "Failed to sign message",
        message: JSON.stringify(error),
        color: "red",
      });
    } finally {
      setSigning(false);
    }
  };

  let canWalletSignError = "";
  if (weightSum < threshold) {
    canWalletSignError = `Threshold not met: ${weightSum} < ${threshold}`;
  }

  const [signature, setSignature] = useState("");

  useEffect(() => {
    async function signMessage() {
      try {
        const signaturesEncoded: { signer: string; signature: string }[] = [];
        for (const [signer, signature] of recovered) {
          signaturesEncoded.push({ signer, signature });
        }

        const account = accountFor({
          address: message.wallet,
          signatures: signaturesEncoded,
        });

        const signature = await account.signMessage(
          ethers.utils.toUtf8Bytes(message.raw),
          message.chainId,
          "eip6492"
        );
        setSignature(signature);
      } catch (error: any) {
        notifications.show({
          title: "Failed to sign message",
          message: JSON.stringify(error),
          color: "red",
        });
      }
    }

    if (!canWalletSignError) {
      signMessage();
    }
  }, [recovered, message, canWalletSignError]);

  return (
    <>
      <Box m="md">
        <Grid grow>
          <MiniCard title="Threshold" value={threshold.toString()} />
          <MiniCard title="Total Weight" value={weightSum.toString()} />
          <MiniCard title="Progress" value={`${progress}%`} />
          {signature && (
            <MiniCard
              shortValue={
                signature.length > 64
                  ? `${signature.slice(0, 64)}...`
                  : undefined
              }
              title="Signature"
              value={signature}
            />
          )}
        </Grid>
      </Box>
      <Box>
        <Grid>
          <Tooltip
            opened={canSignError === "" ? false : undefined}
            label={canSignError}
          >
            <Button
              size="sm"
              m="sm"
              disabled={canSignError !== ""}
              onClick={() => onSign()}
              loading={signing}
            >
              Sign message
            </Button>
          </Tooltip>
        </Grid>
      </Box>
      <Space h="md" />
      <Signatures
        state={state}
        subdigest={ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message.raw))}
        signatures={signatures}
      />
    </>
  );
}
