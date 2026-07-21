import { Anchor, Alert, Button, Loader, Tooltip } from "@mantine/core"
import { useParams } from "react-router-dom"
import { ethers } from "ethers";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { notifications } from "@mantine/notifications";
import { useAccountState } from "../stores/Sequence"
import { CardGrid, MiniCard } from "../components/MiniCard";
import { useWallets } from "../stores/db/Wallets";
import { Signers } from "../components/Signers";
import { publishWitness, useWitnessStatus } from "../stores/Witness";
import { isErrorWithMessage } from "../helpers/errors";
import { Page, PageHeader, Panel, SectionTitle } from "../components/Page";

export function Wallet() {
  const params = useParams<{ address: string }>()
  const address = params.address

  const { wallets } = useWallets()

  const saved = wallets.find(w => w.address === address)
  const { loading, state, error } = useAccountState(address, 1, saved?.version)

  const account = useAccount()
  const { signMessageAsync } = useSignMessage()
  const witness = useWitnessStatus(address, account.address, state?.version)
  const [signingWitness, setSigningWitness] = useState(false)

  if (!address || !ethers.isAddress(address)) {
    return <Page>
      <PageHeader title="Wallet view" />
      Invalid address
    </Page>
  }

  const name = saved?.name

  const isSigner = Boolean(state && account.address && state.signers.some(
    (s) => ethers.getAddress(s.address) === ethers.getAddress(account.address as string)
  ))

  let witnessTooltip = "A witness is a signature published to the Sequence Key Machine that proves this signer takes part in this wallet. Enchanter uses witnesses to auto-detect your wallets when you connect."
  if (!account.address) {
    witnessTooltip += " Connect a signer wallet to publish one."
  } else if (state && !isSigner) {
    witnessTooltip += " The connected account is not a signer of this wallet."
  } else if (witness.published) {
    witnessTooltip += " This signer already published a witness for this wallet."
  }

  const onSignWitness = async () => {
    if (!state) return
    setSigningWitness(true)
    try {
      await publishWitness({
        wallet: address,
        version: state.version,
        signer: account.address as string,
        signMessage: (digest) => signMessageAsync({ message: { raw: digest } }),
      })
      witness.setPublished(true)
      notifications.show({
        title: 'Witness published',
        message: 'This wallet will be auto-detected when this signer connects',
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Failed to publish witness',
        message: isErrorWithMessage(error) && error.message ? error.message : JSON.stringify(error),
        color: 'red',
      })
    } finally {
      setSigningWitness(false)
    }
  }

  return <Page>
    <PageHeader
      title="Wallet view"
      description="Current on-chain configuration of this wallet."
      actions={state && (
        <Tooltip label={witnessTooltip} multiline maw={340}>
          <Button
            variant="default"
            loading={signingWitness}
            disabled={!isSigner || witness.published !== false}
            onClick={() => onSignWitness()}
          >
            {witness.published ? "Witness published" : "Sign witness"}
          </Button>
        </Tooltip>
      )}
    />
    {loading && <Loader />}
    {!loading && <>
      {error && <Alert color="red" title="Failed to load wallet">{"Error: " + error}</Alert>}
      {state && <>
        <CardGrid>
          <MiniCard title="Name" value={name || "Unnamed"} />
          <MiniCard title="Address" value={address} />
          <MiniCard title="Protocol" value={`Sequence v${state.version}`} />
          <MiniCard title="Threshold" value={state.threshold.toString()} />
          <MiniCard title="Signers" value={state.signers.length.toString()} />
          <MiniCard title="Checkpoint" value={state.checkpoint.toString()} />
          <MiniCard title="Details" value={
            <Anchor fz={14} ff="monospace" href={`${state.version === 3 ? 'https://0xsequence.github.io/delphi-view/' : 'https://agusx1211.github.io/delphi-view/'}?input=${address}`} target="_blank" rel="noreferrer">
              Open on Delphiview
            </Anchor>
          } />
        </CardGrid>
        <SectionTitle>Signers</SectionTitle>
        <Panel>
          <Signers signers={state.signers} />
        </Panel>
      </>}
    </>}
  </Page>
}
