import { ActionIcon, Box, Button, Divider, Grid, Loader, Space, Title, Tooltip } from "@mantine/core"
import { useParams } from "react-router-dom"
import { MiniCard } from "../components/MiniCard"
import { Actions } from "../components/Actions"
import { accountFor, NETWORKS, useAccountState, useReceipt, useRecovered } from "../stores/Sequence"
import { Signatures } from "../components/Signatures"
import { AccountStatus } from "@0xsequence/account"
import { universal, commons } from "@0xsequence/core"
import { useAccount, useSendTransaction, useSignMessage } from "wagmi"
import { useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import { ethers } from "ethers"
import { useExport } from "../hooks/Export"
import { useImport } from "../hooks/Import"
import { toUpperFirst } from "../Utils"
import { IconRefresh } from "@tabler/icons-react"
import { TransactionsEntry, digestOf, toSequenceTransactions, useTransaction } from "../stores/db/Transactions"
import { addSignature, useSignatures } from "../stores/db/Signatures"
import { exportData } from "../stores/Exporter"
import { ActionsDecoded } from "../components/ActionsDecoded"
import { isErrorWithMessage } from "../helpers/errors"
import { useSelectedWallet } from "../stores/Storage"

type Config = {
  threshold?: number;
};

export function Transaction() {
  const { subdigest } = useParams<{ subdigest: string }>()

  const title = <>
    <Title order={3} mb="md">Transaction Detail</Title>
  </>

  const transaction = useTransaction({ subdigest})
  const { signatures } = useSignatures({ subdigest })
  const { loading, error, state } = useAccountState(transaction?.wallet)
  const { selectedWalletAddress } = useSelectedWallet()

  useEffect(() => {
    if (transaction?.wallet && selectedWalletAddress !== transaction.wallet) {
      notifications.show({
        title: "Incorrect wallet",
        message: "Transaction wallet not match selected one",
        color: "yellow",
      });
    }
  }, [selectedWalletAddress, transaction])

  if (!subdigest || !transaction || Array.isArray(transaction)) {
    return <>
      {title}
      Transaction not found.
      <Space />
      Try importing data.
    </>
  }

  return <>
    {title}
    <Space h="xs" />
    <Box m="md">
      <Grid grow>
        <MiniCard title="Wallet" value={transaction.wallet} />
        <MiniCard title="Digest" value={digestOf(transaction)} />
        <MiniCard title="Subdigest" value={subdigest} />
        <MiniCard title="Chain ID" value={`${transaction.chainId} (${NETWORKS.find(n => n.chainId === Number(transaction.chainId))?.name})`} />
        <MiniCard title="Space" value={transaction.space} />
        <MiniCard title="Nonce" value={transaction.nonce} />
        <MiniCard title="Actions" value={transaction.transactions.length.toString()} />
        <MiniCard title="First Seen" value={transaction.space ? new Date(Number(transaction.space)).toDateString() : "--"} />
      </Grid>
    </Box>
    <Box m="md">
      <Title order={5} mt="lx">Actions</Title>
      <Actions transaction={transaction} />
      <Space h="md" />
      <Title order={5} mt="lx">Decoded Actions</Title>
      <ActionsDecoded state={{ state, loading }} transaction={transaction} />
    </Box>
    <Space h="md" />
    <Divider />
    <Space h="md" />
    <Box>
      <Title order={5}>Stateful</Title>
      <Space h="xs" />
      {loading && <Loader />}
      {error && "Error: " + error}
      {(state && !loading) && (
        <StatefulTransaction transaction={transaction} state={state} subdigest={subdigest} signatures={signatures.map(s => s.signature)} />
      )}
    </Box>
  </>
}

export function StatefulTransaction(props: { transaction: TransactionsEntry, state: AccountStatus, subdigest: string, signatures: string[] }) {
  const { transaction, state, subdigest, signatures } = props

  const account = useAccount()
  const receipt = useReceipt(transaction)
  const exporter = useExport()
  const importer = useImport()

  const [isExporting, setIsExporting] = useState(false)

  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { sendTransactionAsync } = useSendTransaction()
  
  const threshold = (state.config as Config).threshold as (number | undefined) || 0

  const coder = universal.genericCoderFor(state.config.version)
  const recovered = useRecovered(subdigest, signatures)
  const weightSum = coder.config.signersOf(state.config).filter((s) => recovered.has(s.address)).reduce((acc, signer) => acc + signer.weight, 0)
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
        if (account.chainId?.toString() !== transaction.chainId) {
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
      const signer = coder.config.signersOf(state.config).find(s => s.address === address.toString())
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

      const suffixed = signature + "02"
      notifications.show({
        title: 'Transaction signed',
        message: 'Transaction signed successfully',
        color: 'green',
      });

      await addSignature({ subdigest, signature: suffixed })
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
        chainId: Number(transaction.chainId),
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
    <Box m="md">
      <Grid grow>
        <MiniCard title="Status" value={receipt.loading ? "Loading ..." : toUpperFirst(receipt.status)} />
        <MiniCard title="Tx Hash" value={receipt.loading ? "Loading ..." : receipt.receipt !== "" ? receipt.receipt : "--"} />
        <MiniCard title="Threshold" value={threshold.toString() } />
        <MiniCard title="Total Weight" value={weightSum.toString()} />
        <MiniCard title="Progress" value={`${progress}%`} />
      </Grid>
    </Box>
    <Box >
      <Grid>
        <ActionIcon m="sm" size="lg" variant="filled" aria-label="Refresh" onClick={() => receipt.refresh()} >
          <IconRefresh style={{ width: '70%', height: '70%' }} stroke={1.5} />
        </ActionIcon>
        <Tooltip opened={canSignError === "" ? false : undefined} label={canSignError}>
          <Button size="sm" m="sm" disabled={canSignError !== ""} onClick={() => onSign()} loading={signing}>
            Sign transaction
          </Button>
        </Tooltip>
        <Tooltip opened={canSendError === "" ? false : undefined} label={canSendError}>
          <Button size="sm" m="sm" disabled={canSendError !== ""} onClick={() => onExecute()} loading={sending}>
            Execute transaction
          </Button>
        </Tooltip>
        <Button
          size="sm"
          m="sm"
          variant="outline"
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
          variant="outline"
          size="sm"
          m="sm"
          >
          Import data
        </Button>
      </Grid>
    </Box>
    <Space h="md" />
    <Signatures state={state} subdigest={subdigest} signatures={signatures} />
  </>
}