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
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
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
    subdigest: message?.subdigest,
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
          <MiniCard title="Chain ID" value={String(message.chainId)} />
          <MiniCard
            title="Message"
            value={message.raw}
            shortValue={
              message.raw.length > 64
                ? `${message.raw.slice(0, 64)}...`
                : undefined
            }
          />
          <MiniCard title="Subdigest" value={String(message.subdigest)} />
          <MiniCard title="Digest" value={String(message.digest)} />
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

  const publicClient = usePublicClient({ chainId: message.chainId });

  const recovered = useRecovered(message.subdigest, signatures);

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
      const digestBytes = ethers.utils.arrayify(message.subdigest);
      const signature = await signMessageAsync({
        message: { raw: digestBytes },
      });

      const suffixed = signature + "02";
      notifications.show({
        title: "Message signed",
        message: "Message signed successfully",
        color: "green",
      });

      await addSignature({
        subdigest: message.subdigest,
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
  const [isValid, setIsValid] = useState(false);
  const [walletSigning, setWalletSigning] = useState(false);

  useEffect(() => {
    async function signMessage() {
      try {
        setWalletSigning(true);
        setIsValid(false);
        setSignature("");
        const signaturesEncoded: { signer: string; signature: string }[] = [];
        for (const [signer, signature] of recovered) {
          signaturesEncoded.push({ signer, signature });
        }

        const account = accountFor({
          address: message.wallet,
          signatures: signaturesEncoded,
        });

        const signed = await account.signMessage(
          ethers.utils.toUtf8Bytes(message.raw),
          message.chainId,
          "eip6492"
        );

        const validSig = await publicClient?.verifyMessage({
          message: message.raw,
          address: message.wallet as `0x${string}`,
          signature: ethers.utils.arrayify(signed),
        });

        setIsValid(validSig ?? false);
        setSignature(signed);
      } catch (error: any) {
        notifications.show({
          title: "Failed to sign message",
          message: JSON.stringify(error),
          color: "red",
        });
      } finally {
        setWalletSigning(false);
      }
    }

    if (!canWalletSignError && publicClient) {
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
          <MiniCard
            shortValue={
              signature.length > 64 ? `${signature.slice(0, 64)}...` : undefined
            }
            title="Signature"
            value={walletSigning ? "Loading..." : signature || "--"}
          />
          {signature && <MiniCard title="IsValid" value={String(isValid)} />}
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
        subdigest={message.subdigest}
        signatures={signatures}
      />
    </>
  );
}
