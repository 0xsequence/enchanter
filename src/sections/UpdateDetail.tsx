
import { Box, Button, Grid, Loader, Space, Title, Tooltip } from "@mantine/core"
import { useParams } from "react-router-dom"
import { MiniCard } from "../components/MiniCard"
import { accountFor, UnifiedAccountState, useAccountState, useRecovered, useWalletConfig, v3EnvelopeSignatures, v3SignersOf, v3WalletFor } from "../stores/Sequence"
import { Signatures } from "../components/Signatures"
import { commons, universal } from "@0xsequence/core"
import { useAccount, useSignMessage } from "wagmi"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { ethers } from "ethers"
import { useExport } from "../hooks/Export"
import { useImport } from "../hooks/Import"
import { addSignature, useSignatures } from "../stores/db/Signatures"
import { exportUpdate } from "../stores/Exporter"
import { UpdateEntry, useUpdate } from "../stores/db/Updates"
import { Signers } from "../components/Signers"
import { UpdateDiff } from "../components/UpdateDiff"
import { isErrorWithMessage } from "../helpers/errors"
import { Envelope } from "@0xsequence/wallet-core"
import { Config as V3Config } from "@0xsequence/wallet-primitives"

type Config = {
  threshold?: number;
};

export function UpdateDetail() {
  const { subdigest } = useParams<{ subdigest: string }>()

  const title = <>
    <Title order={3} mb="md">Update Detail</Title>
  </>

  const up = useUpdate({ subdigest })

  const { signatures } = useSignatures({ subdigest: up.update?.subdigest })
  const ac = useAccountState(up.update?.wallet, 1, up.update?.version)

  if (!subdigest) {
    return <>
      {title}
      Invalid update
    </>
  }

  if (ac.loading || up.loading) {
    return <>
      {title}
      <Loader />
    </>
  }

  if (!ac.state || !up.update) {
    return <>
      {title}
      Update {subdigest.toString()} not found.
      <Space />
      Try importing data.
    </>
  }

  if (ac.error) {
    return <>
      {title}
      Error: {ac.error}
    </>
  }

  return <>
    {title}
    <StatefulUpdateDetail subdigest={subdigest} state={ac.state} update={up.update} signatures={signatures.map(s => s.signature)} />
  </>
}

export function StatefulUpdateDetail(props: { subdigest: string, state: UnifiedAccountState, update: UpdateEntry, signatures: string[] }) {
  const { state, update, signatures, subdigest } = props

  const [signing, setSigning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const exporter = useExport()
  const importer = useImport()

  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const config = useWalletConfig(update.imageHash, state.version)

  const walletCheckpoint = state.checkpoint
  const checkpointDelta = BigInt(update.checkpoint) - walletCheckpoint

  const status = BigInt(update.checkpoint) > walletCheckpoint ? "Pending" : "Stale"

  const threshold = state.threshold
  
  const recovered = useRecovered(subdigest, signatures, state.version)
  const weightSum = state.signers.filter((s) => recovered.has(ethers.getAddress(s.address))).reduce((acc, signer) => acc + signer.weight, 0)
  const progress = Math.floor((weightSum / threshold * 100))

  let canSendError = ""
  if (status === "Stale") {
    canSendError = "Update is stale"
  } else if (weightSum < threshold) {
    canSendError = `Threshold not met: ${weightSum} < ${threshold}`
  } else {
    if (!address) {
      canSendError = "Connect your wallet to execute the update"
    }
  }

  let canSignError = ""
  if (address) {
    if (recovered.has(address)) {
      canSignError = "You have already signed this update"
    } else {
      const signer = state.signers.find(s => ethers.getAddress(s.address) === ethers.getAddress(address.toString()))
      if (!signer) {
        canSignError = "You are not a signer of this wallet"
      }
    }
  } else {
    canSignError = "Connect your wallet to sign the update"
  }

  const onSign = async () => {
    setSigning(true)
  
    try {
      const digestBytes = ethers.getBytes(subdigest)
      const signature = await signMessageAsync({ message: { raw: digestBytes } })

      const storedSignature = state.version === 3 ? signature : signature + "02"
      notifications.show({
        title: 'Update signed',
        message: 'Update signed successfully',
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
        title: 'Failed to sign update',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setSigning(false)
    }
  }

  const onExecute = async () => {
    setExecuting(true)

    try {
      if (!config.config) {
        throw new Error("New wallet configuration not found")
      }

      if (state.version === 3) {
        const wallet = v3WalletFor(update.wallet)
        const envelope = await wallet.prepareUpdate(config.config as V3Config.Config)
        await wallet.submitUpdate(
          Envelope.toSigned(envelope, v3EnvelopeSignatures(recovered))
        )
        notifications.show({
          title: 'Update executed',
          message: 'The v3 update is now available to commit on-chain',
          color: 'green',
        })
        return
      }

      const signaturesEncoded: { signer: string, signature: string }[] = []
      for (const [signer, signature] of recovered) {
        signaturesEncoded.push({ signer, signature })
      }

      const account = accountFor({
        address: update.wallet,
        signatures: signaturesEncoded,
      })

      await account.updateConfig((config.config as commons.config.Config))

      notifications.show({
        title: 'Update executed',
        message: 'Refresh the page to see the changes',
        color: 'green',
      })
    } catch (e) {
      let errorMessage;

      if (isErrorWithMessage(e) && e.message) {
        errorMessage = e.message;
      } else {
        errorMessage = JSON.stringify(e);
      }
      notifications.show({
        title: 'Failed to execute update',
        message: errorMessage,
        color: 'red',
      })
    } finally {
      setExecuting(false)
    }
  }

  return <>
    <Box m="md">
      <Grid grow>
        <MiniCard title="Wallet" value={update.wallet} />
        <MiniCard title="ImageHash" value={update.imageHash} />
        <MiniCard title="Subdigest" value={subdigest} />
        <MiniCard title="Status" value={status} />
        <MiniCard title="Checkpoint (wallet)" value={walletCheckpoint.toString()} />
        <MiniCard title="Checkpoint (update)" value={update.checkpoint.toString()} />
        <MiniCard title="Checkpoint Delta" value={checkpointDelta.toString()} />
        <MiniCard title="Threshold" value={threshold.toString() } />
        <MiniCard title="Total Weight" value={weightSum.toString()} />
        <MiniCard title="Progress" value={`${progress}%`} />
      </Grid>
    </Box>
    <Box>
      <Tooltip opened={canSignError === "" ? false : undefined} label={canSignError}>
        <Button size="sm" m="sm" disabled={canSignError !== ""} onClick={() => onSign()} loading={signing}>
          Sign change
        </Button>
      </Tooltip>
      <Tooltip opened={canSendError === "" ? false : undefined} label={canSendError}>
        <Button size="sm" m="sm" disabled={canSendError !== ""} onClick={() => onExecute()} loading={executing}>
          Execute change
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
          const data = await exportUpdate({ update })
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
    </Box>
    <Space h="md" />
    <Box>
      <Title order={4}>New Configuration</Title>
      <Box m="md">
        { config.loading && <Loader /> }
        { config.error && <Box>Error: {JSON.stringify(config.error)}</Box> }
        { config.config && <Box>
          <Grid grow>
            <MiniCard title="Version" value={String(state.version)} />
            <MiniCard title="Threshold" value={String((config.config as Config).threshold)} />
          </Grid>
          <Signers signers={state.version === 3
            ? v3SignersOf(config.config as V3Config.Config)
            : universal.genericCoderFor(config.config.version).config.signersOf(config.config)
          } />
          <Space h="xl" />
          <UpdateDiff
            from={{ threshold: state.threshold, signers: state.signers }}
            to={{
              threshold: Number(config.config.threshold),
              signers: state.version === 3
                ? v3SignersOf(config.config as V3Config.Config)
                : universal.genericCoderFor(config.config.version).config.signersOf(config.config),
            }}
          />
        </Box> } 
      </Box>
    </Box>
    <Space h="md" />
    <Title order={4}>Signatures</Title>
    <Signatures state={state} subdigest={subdigest} signatures={signatures} />
  </>
}
