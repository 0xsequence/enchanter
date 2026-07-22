import { ActionIcon, Button, Group, Loader, Tooltip } from "@mantine/core"
import { useParams } from "react-router-dom"
import { CardGrid, MiniCard } from "../components/MiniCard"
import { Page, PageHeader, Panel, SectionTitle } from "../components/Page"
import { Actions } from "../components/Actions"
import { accountFor, NETWORKS, UnifiedAccountState, V3Provider, useAccountState, useReceipt, useRecovered, v3EnvelopeSignatures, v3TransactionEnvelope, v3TransactionTypedData, v3WalletFor } from "../stores/Sequence"
import { Signatures } from "../components/Signatures"
import { commons } from "@0xsequence/core"
import { useAccount, usePublicClient, useSendTransaction, useSignMessage, useSignTypedData, useSwitchChain } from "wagmi"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { ethers } from "ethers"
import { useExport } from "../hooks/Export"
import { useImport } from "../hooks/Import"
import { IconRefresh } from "@tabler/icons-react"
import { TransactionsEntry, digestOf, toSequenceTransactions, useTransaction } from "../stores/db/Transactions"
import { addSignature, useSignatures } from "../stores/db/Signatures"
import { publishSignature, txServicePayload, useKeyMachineLookup } from "../stores/KeyMachine"
import { postSignatureToMailbox, useMailboxSignatureSync } from "../stores/Mailbox"
import { KeyMachineLookup } from "../components/KeyMachineLookup"
import { exportData } from "../stores/Exporter"
import { ActionsDecoded } from "../components/ActionsDecoded"
import { isErrorWithMessage } from "../helpers/errors"
import { executionResultFromLogs } from "../helpers/receipts"
import { saveReceipt } from "../stores/db/Receipts"
import { Envelope } from "@0xsequence/wallet-core"

const RECEIPT_STATUS_LABELS: Record<string, string> = {
  loading: "Loading ...",
  unknown: "Unknown",
  pending: "Pending",
  executed: "Executed",
  failed: "Failed",
  replaced: "Replaced",
  consumed: "Executed or replaced",
}

export function Transaction() {
  const { subdigest } = useParams<{ subdigest: string }>()

  const title = <PageHeader
    title="Transaction Detail"
    description="Review the staged actions, collect signatures, and execute once the threshold is met."
  />

  const transaction = useTransaction({ subdigest})
  const { signatures } = useSignatures({ subdigest })
  const { loading, error, state } = useAccountState(
    transaction?.wallet,
    Number(transaction?.chainId || 1),
    transaction?.version
  )
  const lookup = useKeyMachineLookup(subdigest, !transaction)
  if (!subdigest || !transaction || Array.isArray(transaction)) {
    return <Page>
      {title}
      <Panel>
        <KeyMachineLookup
          title="Transaction not found."
          status={lookup.status}
          retry={lookup.retry}
        />
      </Panel>
    </Page>
  }

  return <Page>
    {title}
    <CardGrid>
      <MiniCard title="Wallet" value={transaction.wallet} />
      <MiniCard title="Digest" value={digestOf(transaction)} />
      <MiniCard title="Subdigest" value={subdigest} />
      <MiniCard title="Chain ID" value={`${transaction.chainId} (${transaction.chainId === "0" ? "All networks" : NETWORKS.find(n => n.chainId === Number(transaction.chainId))?.name})`} />
      <MiniCard title="Space" value={transaction.space} />
      <MiniCard title="Nonce" value={transaction.nonce} />
      <MiniCard title="Actions" value={transaction.transactions.length.toString()} />
      <MiniCard title="First Seen" value={transaction.space ? new Date(Number(transaction.space)).toDateString() : "--"} />
    </CardGrid>
    <SectionTitle>Actions</SectionTitle>
    <Panel>
      <Actions transaction={transaction} />
    </Panel>
    <SectionTitle>Decoded Actions</SectionTitle>
    <Panel padded>
      <ActionsDecoded state={{ state, loading }} transaction={transaction} />
    </Panel>
    <SectionTitle>Signing status</SectionTitle>
    {loading && <Loader />}
    {error && "Error: " + error}
    {(state && !loading) && (
      <StatefulTransaction transaction={transaction} state={state} subdigest={subdigest} signatures={signatures.map(s => s.signature)} />
    )}
  </Page>
}

export function StatefulTransaction(props: { transaction: TransactionsEntry, state: UnifiedAccountState, subdigest: string, signatures: string[] }) {
  const { transaction, state, subdigest, signatures } = props

  const account = useAccount()
  const receipt = useReceipt(transaction)
  const exporter = useExport()
  const importer = useImport()

  const [isExporting, setIsExporting] = useState(false)

  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { signTypedDataAsync } = useSignTypedData()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const executionChainId = transaction.chainId === "0"
    ? account.chainId
    : Number(transaction.chainId)
  const publicClient = usePublicClient({ chainId: executionChainId })
  
  const threshold = state.threshold
  const recovered = useRecovered(subdigest, signatures, state.version)
  const weightSum = state.signers.filter((s) => recovered.has(ethers.getAddress(s.address))).reduce((acc, signer) => acc + signer.weight, 0)
  const progress = Math.floor((weightSum / threshold * 100))

  useMailboxSignatureSync({
    subdigest,
    version: state.version,
    enabled: weightSum < threshold,
    onFound: (added) => notifications.show({
      title: 'Signatures synced',
      message: `Found ${added} co-signer signature${added === 1 ? '' : 's'} via the Key Machine`,
      color: 'green',
    }),
  })

  let canSendError = ""
  if (weightSum < threshold) {
    canSendError = `Threshold not met: ${weightSum} < ${threshold}`
  } else {
    if (!address) {
      canSendError = "Connect your wallet to execute the transaction"
    } else {
      if (receipt.loading || receipt.status === "loading") {
        canSendError = "Loading transaction status"
      } else if (receipt.status === "executed" || receipt.status === "failed") {
        canSendError = "Already executed"
      } else if (receipt.status === "replaced") {
        canSendError = "The nonce was consumed by another transaction"
      } else if (receipt.status === "consumed") {
        canSendError = "Already executed or replaced"
      } else {
        if (account.chainId?.toString() !== transaction.chainId && transaction.chainId !== "0") {
          canSendError = "Switch to the correct network"
        }
      }
    }
  }

  let canSignError = ""
  if (address) {
    if (recovered.has(address)) {
      canSignError = "You have already signed this transaction"
    } else {
      const signer = state.signers.find(s => ethers.getAddress(s.address) === ethers.getAddress(address.toString()))
      if (!signer) {
        canSignError = "You are not a signer of this wallet"
      }
    }
  } else {
    canSignError = "Connect your wallet to sign the transaction"
  }


  const [signing, setSigning] = useState(false)
  const onSign = async () => {
    setSigning(true)
  
    try {
      // v3 signs the actual payload as EIP-712 typed data (its hash is the
      // subdigest); v2 wallets personal_sign the subdigest
      let storedSignature: string
      let mailboxSignature: string
      if (state.version === 3) {
        // Wallets reject typed-data requests whose domain chain differs from
        // the active chain, so hop first (chain 0 = all networks, always accepted)
        const targetChainId = Number(transaction.chainId)
        if (targetChainId !== 0 && account.chainId !== targetChainId) {
          await switchChainAsync({ chainId: targetChainId })
        }
        const signature = await signTypedDataAsync(v3TransactionTypedData(transaction))
        storedSignature = signature + "01"
        mailboxSignature = storedSignature
      } else {
        const signature = await signMessageAsync({ message: { raw: ethers.getBytes(subdigest) } })
        storedSignature = signature + "02"
        mailboxSignature = signature
      }

      notifications.show({
        title: 'Transaction signed',
        message: 'Transaction signed successfully',
        color: 'green',
      });

      await addSignature({ subdigest, signature: storedSignature })

      postSignatureToMailbox(subdigest, mailboxSignature)
      if (state.version === 3) {
        publishSignature({
          wallet: transaction.wallet,
          chainId: transaction.chainId,
          payload: txServicePayload(transaction),
          signature: storedSignature,
        })
      }
    } catch (error) {
      let errorMessage;

      if (isErrorWithMessage(error) && error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
      notifications.show({
        title: 'Failed to sign transaction',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setSigning(false)
    }
  }

  const [sending, setSending] = useState(false)

  // Follows a submitted execution all the way to its on-chain receipt, so the
  // recorded outcome comes from the mined logs instead of a later log search
  const trackExecution = async (hash: `0x${string}`) => {
    const notifyId = `execute-${subdigest}`
    notifications.show({
      id: notifyId,
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: 'Transaction submitted',
      message: hash,
    })

    try {
      if (!publicClient) throw new Error("Client not found")
      const mined = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 })

      if (mined.status === "reverted") {
        // The outer transaction reverted, so the nonce is still unspent and
        // the transaction can be retried
        notifications.update({
          id: notifyId,
          loading: false,
          autoClose: false,
          withCloseButton: true,
          title: 'Execution reverted',
          message: hash,
          color: 'red',
        })
        receipt.refresh()
        return
      }

      const result = executionResultFromLogs(mined.logs, {
        wallet: transaction.wallet,
        subdigest,
        version: state.version,
      })

      if (result && executionChainId !== undefined) {
        await saveReceipt({
          subdigest,
          chainId: executionChainId,
          status: result.status,
          txHash: mined.transactionHash,
          blockNumber: mined.blockNumber,
        })
      }

      if (result?.status === "failed") {
        notifications.update({
          id: notifyId,
          loading: false,
          autoClose: false,
          withCloseButton: true,
          title: 'Transaction failed',
          message: hash,
          color: 'red',
        })
      } else {
        notifications.update({
          id: notifyId,
          loading: false,
          autoClose: false,
          withCloseButton: true,
          title: 'Transaction executed',
          message: hash,
          color: 'green',
        })
      }

      if (!result) {
        receipt.refresh()
      }
    } catch (error) {
      console.error("Timed out waiting for the execution receipt", error)
      notifications.update({
        id: notifyId,
        loading: false,
        autoClose: false,
        withCloseButton: true,
        title: 'Transaction pending',
        message: 'Confirmation is taking a while — the status will update automatically once it lands',
        color: 'yellow',
      })
      receipt.refresh()
    }
  }

  const onExecute = async () => {
    setSending(true)

    try {
      if (state.version === 3) {
        if (!publicClient) throw new Error("Client not found")
        if (!executionChainId) throw new Error("Connect to the network where you want to execute")
        const envelope = v3TransactionEnvelope(transaction, state)
        const signed = Envelope.toSigned(envelope, v3EnvelopeSignatures(recovered))
        const built = await v3WalletFor(transaction.wallet).buildTransaction(
          publicClient as V3Provider,
          signed
        )
        const tx = await sendTransactionAsync({
          chainId: executionChainId,
          to: built.to,
          data: built.data,
        })
        await trackExecution(tx)
        return
      }

      const sequenceTxs = toSequenceTransactions(transaction.transactions)

      const signaturesEncoded: { signer: string, signature: string }[] = []
      for (const [signer, signature] of recovered) {
        signaturesEncoded.push({ signer, signature })
      }

      const account = accountFor({
        address: transaction.wallet,
        signatures: signaturesEncoded,
      })

      // We don't have a relayer for wagmi, so we need to send the transaction ourselves
      const status = await account.status(transaction.chainId)
      const wallet = account.walletForStatus(transaction.chainId, status)
      const signed = await wallet.signTransactions(sequenceTxs, commons.transaction.encodeNonce(transaction.space, transaction.nonce))

      const chainedSignature = await account.decorateSignature(signed.signature, status)

      const decorated = await account.decorateTransactions({
        ...signed,
        signature: chainedSignature
      } as commons.transaction.SignedTransactionBundle, status, transaction.chainId)

      const encoded = commons.transaction.encodeBundleExecData(decorated)

      console.log("Sending transaction ...", decorated.entrypoint, encoded)

      const tx = await sendTransactionAsync({
        chainId: executionChainId,
        to: decorated.entrypoint as `0x${string}`,
        data: encoded as `0x${string}`,
      })

      await trackExecution(tx)
    } catch (error) {
      let errorMessage;

        if (isErrorWithMessage(error) && error.message) {
          errorMessage = error.message;
        } else {
          errorMessage = JSON.stringify(error);
        }
      notifications.show({
        title: 'Failed to execute transaction',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setSending(false)
    }
  }

  return <>
    <CardGrid>
      <MiniCard title="Status" value={receipt.loading ? "Loading ..." : RECEIPT_STATUS_LABELS[receipt.status] ?? receipt.status} />
      <MiniCard title="Tx Hash" value={receipt.loading ? "Loading ..." : receipt.locating ? "Locating ..." : receipt.receipt !== "" ? receipt.receipt : "--"} />
      <MiniCard title="Threshold" value={threshold.toString() } />
      <MiniCard title="Total Weight" value={weightSum.toString()} />
      <MiniCard title="Progress" value={`${progress}%`} progress={progress} />
    </CardGrid>
    <Group gap="sm" my="lg">
      <ActionIcon size="lg" variant="default" aria-label="Refresh" onClick={() => receipt.refresh()} >
        <IconRefresh style={{ width: '60%', height: '60%' }} stroke={1.5} />
      </ActionIcon>
      <Tooltip opened={canSignError === "" ? false : undefined} label={canSignError}>
        <Button size="sm" disabled={canSignError !== ""} onClick={() => onSign()} loading={signing}>
          Sign transaction
        </Button>
      </Tooltip>
      <Tooltip opened={canSendError === "" ? false : undefined} label={canSendError}>
        <Button size="sm" disabled={canSendError !== ""} onClick={() => onExecute()} loading={sending}>
          Execute transaction
        </Button>
      </Tooltip>
      <Button
        size="sm"
        variant="default"
        loading={isExporting}
        onClick={async () => {
          if (isExporting) return
          setIsExporting(true)
          const data = await exportData({ tx: transaction })
          exporter.open(data)
          setIsExporting(false)
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
      <Signatures state={state} subdigest={subdigest} signatures={signatures} />
    </Panel>
  </>
}
