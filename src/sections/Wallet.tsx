import { Box, Grid, Loader, Title } from "@mantine/core"
import { useParams } from "react-router-dom"
import { useAccountState } from "../stores/Sequence"
import { ethers } from "ethers";
import { MiniCard } from "../components/MiniCard";
import { useWallets } from "../stores/db/Wallets";
import { Signers } from "../components/Signers";

export function Wallet() {
  const params = useParams<{ address: string }>()
  const address = params.address

  const { wallets } = useWallets()

  const title = <>
    <Title order={3} mb="md">Wallet view</Title>
  </>

  const saved = wallets.find(w => w.address === address)
  const { loading, state, error } = useAccountState(address, 1, saved?.version)
  
  if (!address || !ethers.isAddress(address)) {
    return <>
      {title}
      Invalid address
    </>
  }

  const name = saved?.name

  return <>
    {title}
    {loading && <Loader />}
    {!loading && <Box>
      {error && "Error: " + error}
      {state && <Box>
        <Grid grow mb="md">
          <MiniCard title="Name" value={name || "Unnamed"} />
          <MiniCard title="Address" value={address} />
          <MiniCard title="Protocol" value={`Sequence v${state.version}`} />
          <MiniCard title="Threshold" value={state.threshold.toString()} />
          <MiniCard title="Signers" value={state.signers.length.toString()} />
          <MiniCard title="Checkpoint" value={state.checkpoint.toString()} />
          <MiniCard title="Details" value={
            <a href={`https://agusx1211.github.io/delphi-view/?input=${address}`} target="_blank" rel="noreferrer">
              Open on Delphiview
            </a>
          } />
        </Grid>
        <Title order={5} mb="md">Signers</Title>
        <Signers signers={state.signers} />
      </Box>}
    </Box>}
  </>
}
