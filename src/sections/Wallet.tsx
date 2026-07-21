import { Anchor, Alert, Loader } from "@mantine/core"
import { useParams } from "react-router-dom"
import { ethers } from "ethers";
import { useAccountState } from "../stores/Sequence"
import { CardGrid, MiniCard } from "../components/MiniCard";
import { useWallets } from "../stores/db/Wallets";
import { Signers } from "../components/Signers";
import { Page, PageHeader, Panel, SectionTitle } from "../components/Page";

export function Wallet() {
  const params = useParams<{ address: string }>()
  const address = params.address

  const { wallets } = useWallets()

  const saved = wallets.find(w => w.address === address)
  const { loading, state, error } = useAccountState(address, 1, saved?.version)

  if (!address || !ethers.isAddress(address)) {
    return <Page>
      <PageHeader title="Wallet view" />
      Invalid address
    </Page>
  }

  const name = saved?.name

  return <Page>
    <PageHeader
      title="Wallet view"
      description="Current on-chain configuration of this wallet."
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
