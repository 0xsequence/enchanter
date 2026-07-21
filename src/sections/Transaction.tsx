import { ActionIcon, Button, Group, Loader, Tooltip } from "@mantine/core"
import { useParams } from "react-router-dom"
import { CardGrid, MiniCard } from "../components/MiniCard"
import { EmptyState, Page, PageHeader, Panel, SectionTitle } from "../components/Page"
import { Actions } from "../components/Actions"
import { accountFor, NETWORKS, UnifiedAccountState, V3Provider, useAccountState, useReceipt, useRecovered, v3EnvelopeSignatures, v3TransactionEnvelope, v3WalletFor } from "../stores/Sequence"
import { Signatures } from "../components/Signatures"
import { commons } from "@0xsequence/core"
import { useAccount, usePublicClient, useSendTransaction, useSignMessage } from "wagmi"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { ethers } from "ethers"
import { useExport } from "../hooks/Export"
import { useImport } from "../hooks/Import"
import { toUpperFirst } from "../Utils"
import { IconFileSearch, IconRefresh } from "@tabler/icons-react"
import { TransactionsEntry, digestOf, toSequenceTransactions, useTransaction } from "../stores/db/Transactions"
import { addSignature, useSignatures } from "../stores/db/Signatures"
import { exportData } from "../stores/Exporter"
import { ActionsDecoded } from "../components/ActionsDecoded"
import { isErrorWithMessage } from "../helpers/errors"
import { Envelope } from "@0xsequence/wallet-core"

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
  if (!subdigest || !transaction || Array.isArray(transaction)) {
    return <Page>
      {title}
      <Panel>
        <EmptyState
          icon={<IconFileSearch size="1.2rem" stroke={1.5} />}
          title="Transaction not found."
          description="Try importing data."
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
  const { sendTransactionAsync } = useSendTransaction()
  const executionChainId = transaction.chainId === "0"
    ? account.chainId
    : Number(transaction.chainId)
  const publicClient = usePublicClient({ chainId: executionChainId })
  
  const threshold = state.threshold
  const recovered = useRecovered(subdigest, signatures, state.version)
  const weightSum = state.signers.filter((s) => recovered.has(ethers.getAddress(s.address))).reduce((acc, signer) => acc + signer.weight, 0)
  const progress = Math.floor((weightSum / threshold * 100))

  let canSendError = ""
  if (weightSum < threshold) {
    canSendError = `Threshold not met: ${weightSum} < ${threshold}`
  } else {
    if (!address) {
      canSendError = "Connect your wallet to execute the transaction"
    } else {
      if (receipt.loading) {
        canSendError = "Loading transaction status"
      } else if (receipt.receipt) {
        canSendError = "Already executed"
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
      const digestBytes = ethers.getBytes(subdigest)
      const signature = await signMessageAsync({ message: { raw: digestBytes } })

      const storedSignature = state.version === 3 ? signature : signature + "02"
      notifications.show({
        title: 'Transaction signed',
        message: 'Transaction signed successfully',
        color: 'green',
      });

      await addSignature({ subdigest, signature: storedSignature })
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
        notifications.show({
          title: 'Transaction executed',
          message: tx,
          color: 'green',
        })
        receipt.refresh()
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

      notifications.show({
        title: 'Transaction executed',
        message: tx,
        color: 'green',
      })

      receipt.refresh()
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
      <MiniCard title="Status" value={receipt.loading ? "Loading ..." : toUpperFirst(receipt.status)} />
      <MiniCard title="Tx Hash" value={receipt.loading ? "Loading ..." : receipt.receipt !== "" ? receipt.receipt : "--"} />
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
