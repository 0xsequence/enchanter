import { Box, Grid, Loader, Title } from "@mantine/core"
import { useParams } from "react-router-dom"
import { useAccountState } from "../stores/Sequence"
import { ethers } from "ethers";
import { MiniCard } from "../components/MiniCard";
import { v2 } from "@0xsequence/core";
import { useWallets } from "../stores/Storage";
import { Signers } from "../components/Signers";

export function Wallet() {
  const params = useParams<{ address: string }>()
  const address = params.address

  const wallets = useWallets()

  const title = <>
    <Title order={3} mb="md">Wallet view</Title>
  </>

  if (!address || !ethers.utils.isAddress(address)) {
    return <>
      {title}
      Invalid address
    </>
  }

  const { loading, state, error } = useAccountState(params.address)
  if (state && v2.config.isWalletConfig(state.config) === false) {
    return <>
      {title}
      Unsupported wallet version
    </>
  }

  const config = state?.config as v2.config.WalletConfig
  const name = wallets.find(w => w.address === address)?.name

  return <>
    {title}
    {loading && <Loader />}
    {!loading && <Box>
      {error && "Error: " + error}
      {state && config && <Box>
        <Grid grow mb="md">
          <MiniCard title="Name" value={name || "Unnamed"} />
          <MiniCard title="Address" value={address} />
          <MiniCard title="Threshold" value={config.threshold.toString()} />
          <MiniCard title="Signers" value={v2.config.ConfigCoder.signersOf(config).length.toString()} />
          <MiniCard title="Checkpoint" value={config.checkpoint.toString()} />
        </Grid>
        <Title order={5} mb="md">Signers</Title>
        <Signers config={config} />
      </Box>}
    </Box>}
  </>
}
