
import { Box, Button, Grid, Loader, Space, Title, Tooltip } from "@mantine/core"
import { useParams } from "react-router-dom"
import { MiniCard } from "../components/MiniCard"
import { accountFor, useAccountState, useRecovered, useWalletConfig } from "../stores/Sequence"
import { Signatures } from "../components/Signatures"
import { AccountStatus } from "@0xsequence/account"
import { universal } from "@0xsequence/core"
import { useAccount, useSignMessage } from "wagmi"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { ethers } from "ethers"
import { useExport } from "./Export"
import { useImport } from "./Import"
import { addSignature, useSignatures } from "../stores/db/Signatures"
import { exportUpdate } from "../stores/Exporter"
import { UpdateEntry, useUpdate } from "../stores/db/Updates"
import { Signers } from "../components/Signers"
import { UpdateDiff } from "../components/UpdateDiff"

export function UpdateDetail() {
  const { subdigest } = useParams<{ subdigest: string }>()

  const title = <>
    <Title order={3} mb="md">Update Detail</Title>
  </>

  if (!subdigest) {
    return <>
      {title}
      Invalid update
    </>
  }

  const up = useUpdate({ subdigest })

  const { signatures } = useSignatures({ subdigest: up.update?.subdigest })
  const ac = useAccountState(up.update?.wallet)

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

export function StatefulUpdateDetail(props: { subdigest: string, state: AccountStatus, update: UpdateEntry, signatures: string[] }) {
  const { state, update, signatures, subdigest } = props

  const [signing, setSigning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const exporter = useExport()
  const importer = useImport()

  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const config = useWalletConfig(update.imageHash)

  const coder = universal.genericCoderFor(state.config.version)
  const walletCheckpoint = coder.config.checkpointOf(state.config)
  const checkpointDelta = update.checkpoint - walletCheckpoint.toNumber()

  const status = update.checkpoint > walletCheckpoint.toNumber() ? "Pending" : "Stale"

  const threshold = (state.config as any).threshold as (number | undefined)
  if (!threshold) {
    return <Box>Threshold not found</Box>
  }

  const recovered = useRecovered(subdigest, signatures)
  const weightSum = coder.config.signersOf(state.config).filter((s) => recovered.has(s.address)).reduce((acc, signer) => acc + signer.weight, 0)
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
      const signer = coder.config.signersOf(state.config).find(s => s.address === address.toString())
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
      const digestBytes = ethers.utils.arrayify(subdigest)
      const signature = await signMessageAsync({ message: { raw: digestBytes } })

      const suffixed = signature + "02"
      notifications.show({
        title: 'Update signed',
        message: 'Update signed successfully',
        color: 'green',
      });

      await addSignature({ subdigest, signature: suffixed })
    } catch (error: any) {
      notifications.show({
        title: 'Failed to sign update',
        message: JSON.stringify(error),
        color: 'red',
      });
    } finally {
      setSigning(false)
    }
  }

  const onExecute = async () => {
    setExecuting(true)

    try {
      const signaturesEncoded: { signer: string, signature: string }[] = []
      for (const [signer, signature] of recovered) {
        signaturesEncoded.push({ signer, signature })
      }

      const account = accountFor({
        address: update.wallet,
        signatures: signaturesEncoded,
      })

      await account.updateConfig(config.config)

      notifications.show({
        title: 'Update executed',
        message: 'Refresh the page to see the changes',
        color: 'green',
      })
    } catch (e) {
      notifications.show({
        title: 'Failed to execute update',
        message: JSON.stringify(e),
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
            <MiniCard title="Version" value={config.config.version} />
            <MiniCard title="Threshold" value={config.config.threshold.toString()} />
          </Grid>
          <Signers config={config.config} />
          <Space h="xl" />
          <UpdateDiff
            from={state.config}
            to={config.config}
          />
        </Box> } 
      </Box>
    </Box>
    <Space h="md" />
    <Title order={4}>Signatures</Title>
    <Signatures state={state} subdigest={subdigest} signatures={signatures} />
  </>
}
