/* eslint-disable react-hooks/exhaustive-deps */
import {
  Anchor,
  Button,
  Group,
  Loader,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { CardGrid, MiniCard } from "../components/MiniCard";
import { Page, PageHeader, Panel, SectionTitle } from "../components/Page";
import { commons } from "@0xsequence/core";
import { useParams } from "react-router-dom";
import { accountFor, NETWORKS, UnifiedAccountState, V3Provider, useAccountState, useRecovered, v3EnvelopeSignatures, v3WalletFor } from "../stores/Sequence";
import { useSignatures, addSignature } from "../stores/db/Signatures";
import { IconRefresh } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSignMessage,
  useSendTransaction,
} from "wagmi";
import { Signatures } from "../components/Signatures";
import { MessageEntry, useMessage } from "../stores/db/Messages";
import { ethers } from "ethers";
import { useExport } from "../hooks/Export";
import { useImport } from "../hooks/Import";
import { exportMessage } from "../stores/Exporter";
import { messageServicePayload, publishSignature, useKeyMachineLookup } from "../stores/KeyMachine";
import { KeyMachineLookup } from "../components/KeyMachineLookup";
import { postSignatureToMailbox, useMailboxSignatureSync } from "../stores/Mailbox";
import { isErrorWithMessage } from "../helpers/errors";
import { Envelope } from "@0xsequence/wallet-core";

export function Message() {
  const { subdigest } = useParams<{ subdigest: string }>();

  const title = (
    <PageHeader
      title="Message Detail"
      description="Review the message, collect signatures, and build the final wallet signature."
    />
  );

  const message = useMessage({ subdigest });
  const { signatures } = useSignatures({
    subdigest: message?.subdigest,
  });
  const { loading, error, state } = useAccountState(
    message?.wallet,
    message?.chainId,
    message?.version
  );
  const lookup = useKeyMachineLookup(subdigest, !message);
  if (!subdigest || !message) {
    return (
      <Page>
        {title}
        <Panel>
          <KeyMachineLookup
            title="Message not found"
            status={lookup.status}
            retry={lookup.retry}
          />
        </Panel>
      </Page>
    );
  }

  return (
    <Page>
      {title}
      <CardGrid>
        <MiniCard title="Wallet" value={message.wallet} />
        <MiniCard title="Chain ID" value={`${message.chainId} (${NETWORKS.find(n => n.chainId === message.chainId)?.name})`} />
        <MiniCard
          title="Message"
          value={message.raw}
          shortValue={
            message.raw.length > 64
              ? `${message.raw.slice(0, 64)}...`
              : undefined
          }
        />
        <MiniCard title="Subdigest" value={message.subdigest} />
        <MiniCard title="Digest" value={message.digest} />
        <MiniCard title="First Seen" value={message.firstSeen ? new Date(message.firstSeen).toDateString() : "--"} />
      </CardGrid>
      <SectionTitle>Signing status</SectionTitle>
      {loading && <Loader />}
      {error && "Error: " + error}
      {state && !loading && (
        <StatefulMessage
          message={message}
          state={state}
          signatures={signatures.map((s) => s.signature)}
        />
      )}
    </Page>
  );
}

export function StatefulMessage(props: {
  message: MessageEntry;
  state: UnifiedAccountState;
  signatures: string[];
}) {
  const { message, signatures, state } = props;

  const account = useAccount();
  const publicClient = usePublicClient({ chainId: message.chainId });

  const recovered = useRecovered(message.subdigest, signatures, state.version);

  const exporter = useExport();
  const importer = useImport();

  const [isExporting, setIsExporting] = useState(false);

  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();

  const threshold = state.threshold;

  const weightSum = state.signers
    .filter((s) => recovered.has(ethers.getAddress(s.address)))
    .reduce((acc, signer) => acc + signer.weight, 0);
  const progress = Math.floor((weightSum / threshold) * 100);

  useMailboxSignatureSync({
    subdigest: message.subdigest,
    version: state.version,
    enabled: weightSum < threshold,
    onFound: (added) => notifications.show({
      title: "Signatures synced",
      message: `Found ${added} co-signer signature${added === 1 ? "" : "s"} via the Key Machine`,
      color: "green",
    }),
  });

  let canSignError = "";
  if (address) {
    if (recovered.has(address)) {
      canSignError = "You have already signed this message";
    } else {
      const signer = state.signers
        .find((s) => ethers.getAddress(s.address) === ethers.getAddress(address.toString()));
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
      const digestBytes = ethers.getBytes(message.subdigest);
      const signature = await signMessageAsync({
        message: { raw: digestBytes },
      });

      const storedSignature = state.version === 3 ? signature : signature + "02";
      notifications.show({
        title: "Message signed",
        message: "Message signed successfully",
        color: "green",
      });

      await addSignature({
        subdigest: message.subdigest,
        signature: storedSignature,
      });

      postSignatureToMailbox(message.subdigest, signature);
      if (state.version === 3) {
        publishSignature({
          wallet: message.wallet,
          chainId: message.chainId,
          payload: messageServicePayload(message.raw),
          signature,
        });
      }
    } catch (error: unknown) {
      let errorMessage;

      if (isErrorWithMessage(error) && error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
      notifications.show({
        title: "Failed to sign message",
        message: errorMessage,
        color: "red",
      });
    } finally {
      setSigning(false);
    }
  };

  let canDeployError = "";
  if (!address) {
    canDeployError = "Connect your wallet to execute the deploy transaction";
  } else {
    if (state.deployed) {
      canDeployError = "Wallet already deployed";
    } else {
      if (account.chainId !== message.chainId) {
        canDeployError = "Switch to the correct network";
      }
    }
  }

  const [deploying, setDeploying] = useState(false);
  const onDeploy = async () => {
    setDeploying(true);

    try {
      if (state.version === 3) {
        const built = await v3WalletFor(message.wallet).buildDeployTransaction()
        const tx = await sendTransactionAsync({
          chainId: Number(message.chainId),
          to: built.to,
          data: built.data,
        })
        notifications.show({
          title: "Wallet deployed",
          message: tx,
          color: "green",
        })
        return
      }

      const account = accountFor({ address: message.wallet });

      const decorated = await account.buildBootstrapTransactions(
        state.legacy!,
        message.chainId
      );
      const encoded = commons.transaction.encodeBundleExecData(decorated);

      const tx = await sendTransactionAsync({
        chainId: Number(message.chainId),
        to: decorated.entrypoint as `0x${string}`,
        data: encoded as `0x${string}`,
      });

      notifications.show({
        title: "Wallet deployed",
        message: tx,
        color: "green",
      });
    } catch (error: unknown) {
      let errorMessage;

      if (isErrorWithMessage(error) && error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
      notifications.show({
        title: "Failed to deploy wallet",
        message: errorMessage,
        color: "red",
      });
    } finally {
      setDeploying(false);
    }
  };

  const [signature, setSignature] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [walletSigning, setWalletSigning] = useState(false);

  async function signMessage() {
    try {
      setWalletSigning(true);
      setIsValid(false);
      setSignature("");
      const signaturesEncoded: { signer: string; signature: string }[] = [];
      for (const [signer, signature] of recovered) {
        signaturesEncoded.push({ signer, signature });
      }

      let signed: string
      if (state.version === 3) {
        const wallet = v3WalletFor(message.wallet)
        const envelope = await wallet.prepareMessageSignature(message.raw, message.chainId)
        const signedEnvelope = Envelope.toSigned(envelope, v3EnvelopeSignatures(recovered))
        signed = ethers.hexlify(
          await wallet.buildMessageSignature(signedEnvelope, publicClient as V3Provider)
        )
      } else {
        const account = accountFor({
          address: message.wallet,
          signatures: signaturesEncoded,
        });

        signed = await account.signMessage(
          ethers.toUtf8Bytes(message.raw),
          message.chainId,
          "eip6492"
        );
      }

      const validSig = await publicClient?.verifyMessage({
        message: message.raw,
        address: message.wallet as `0x${string}`,
        signature: ethers.getBytes(signed),
      });

      setSignature(signed);
      setIsValid(validSig ?? false);

      if (!validSig) {
        throw new Error("Could not validate signature");
      }
    } catch (error: unknown) {
      let errorMessage;

      if (isErrorWithMessage(error) && error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }

      notifications.show({
        title: "Failed to sign message",
        message: errorMessage,
        color: "red",
      });
    } finally {
      setWalletSigning(false);
    }
  }

  useEffect(() => {
    if (threshold <= weightSum) {
      signMessage();
    }
  }, [weightSum, threshold]);

  return (
    <>
      <CardGrid>
        <MiniCard title="Threshold" value={threshold.toString()} />
        <MiniCard title="Total Weight" value={weightSum.toString()} />
        <MiniCard title="Progress" value={`${progress}%`} progress={progress} />
        <MiniCard
          shortValue={
            signature.length > 64 ? `${signature.slice(0, 64)}...` : undefined
          }
          title="Signature"
          value={walletSigning ? "Loading..." : signature || "--"}
        />
        {signature && <MiniCard title="Is Valid" value={String(isValid)} />}
        {signature && (
          <MiniCard
            title="Signature Type"
            value={state.deployed ? (
              <Anchor
                fz={14}
                ff="monospace"
                href="https://eips.ethereum.org/EIPS/eip-1271"
                target="_blank"
                rel="noreferrer"
              >
                ERC-1271
              </Anchor>
            ) : (
              <Anchor
                fz={14}
                ff="monospace"
                href="https://eips.ethereum.org/EIPS/eip-6492"
                target="_blank"
                rel="noreferrer"
              >
                ERC-6492
              </Anchor>
            )}
          />
        )}
      </CardGrid>
      <Group gap="sm" my="lg">
        <ActionIcon
          size="lg"
          variant="default"
          aria-label="Refresh"
          onClick={() => signMessage()}
        >
          <IconRefresh style={{ width: "60%", height: "60%" }} stroke={1.5} />
        </ActionIcon>
        <Tooltip
          opened={canSignError === "" ? false : undefined}
          label={canSignError}
        >
          <Button
            size="sm"
            disabled={canSignError !== ""}
            onClick={() => onSign()}
            loading={signing}
          >
            Sign message
          </Button>
        </Tooltip>
        <Tooltip
          opened={canDeployError === "" ? false : undefined}
          label={canDeployError}
        >
          <Button
            size="sm"
            disabled={canDeployError !== ""}
            onClick={() => onDeploy()}
            loading={deploying}
          >
            Deploy wallet
          </Button>
        </Tooltip>
        <Button
          size="sm"
          variant="default"
          loading={isExporting}
          onClick={async () => {
            if (isExporting) return;
            setIsExporting(true);
            const data = await exportMessage({ message });
            exporter.open(data);
            setIsExporting(false);
          }}
        >
          Export data
        </Button>
        <Button
          onClick={() => importer.open()}
          variant="default"
          size="sm"
        >
          Import data
        </Button>
      </Group>
      <Panel>
        <Signatures
          state={state}
          subdigest={message.subdigest}
          signatures={signatures}
        />
      </Panel>
    </>
  );
}
