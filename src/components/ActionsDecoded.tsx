import { Box, Loader, Space, Title } from "@mantine/core";
import { FlatTransaction, TransactionsEntry } from "../stores/db/Transactions";
import { AccountStatus } from "@0xsequence/account";
import { ethers } from "ethers";
import useFunctionSignature, { FunctionSignature } from "../stores/FunctionSignature";
import { decodeFunctionData } from "viem";
import { ParsedFunctionSelector, parseFunctionSelector, parsedToAbi } from "../Utils";
import { UpdateDiff } from "./UpdateDiff";
import { useWalletConfig } from "../stores/Sequence";
import { universal } from "@0xsequence/core";

export function ActionArguments(props: { action: FlatTransaction, signature: FunctionSignature }) {
  let parsed: ParsedFunctionSelector | undefined = undefined
  let error: string | undefined = undefined
  
  try {
    parsed = parseFunctionSelector(props.signature.text_signature)
  } catch (e) {
    error = (e as Error).message || "Unknown error"
  }

  const decoded = parsed && decodeFunctionData({
    abi: parsedToAbi(parsed),
    data: (props.action.data || "0x") as `0x${string}`
  })

  return <>
    {decoded && <Box>
      {decoded.args?.map((input, i) => <Box key={i}>
        - <b>{parsed?.inputs[i]?.name || i.toString()}</b>: {String(input)}
      </Box>)}
    </Box>}
    {error && <Box>
      {error}
    </Box>}
  </>
}

export function ActionUpdateImageHash(props: { action: FlatTransaction, state: { loading: boolean, state?: AccountStatus }}) {
  const { action, state } = props

  const imageHash = ethers.utils.arrayify(action.data || "0x").slice(4)
  const toConfig = useWalletConfig(ethers.utils.hexlify(imageHash))
  const fromConfig = state.state?.onChain?.config

  const isStale = (() => {
    if (!toConfig.config) return
    if (!fromConfig) return

    const coderFrom = universal.genericCoderFor(fromConfig.version)
    const coderTo = universal.genericCoderFor(toConfig.config.version)

    return coderFrom.config.checkpointOf(fromConfig).toNumber() >= coderTo.config.checkpointOf(toConfig.config).toNumber()
  })()

  return <Box>
    <b>Notice! This transaction settles pending commits</b>
    {isStale && <Box mt="md">
      (In Development) Already executed transactions will show invalid config changes  
    </Box>}
    {(state.loading || toConfig.loading) && <Box>Loading...</Box>}
    {!state.loading && !state.state && "Error loading account status"}
    {(toConfig.error || (!toConfig.loading && !toConfig.config)) && <Box style={{ color: "red" }}>
      <b>WARNING! WARNING! WARNING! Committing to unknown config, please contact Sequence Support</b>
    </Box>}
    {fromConfig && toConfig.config && <Box mt="md"><UpdateDiff from={fromConfig} to={toConfig.config} noAlert /></Box>}
  </Box>
}

const updateImageHashSelector = "29561426"

const warningMethods = [{
  name: "Self Execute",
  selector: "61c2926c"
}, {
  name: "Update Code",
  selector: "025b22bc"
}, {
  name: "Update ImageHash + IPFS",
  selector: "d0748f71"
}, {
  name: "Set extra ImageHash",
  selector: "4598154f"
}, {
  name: "Add hook",
  selector: "b93ea7ad"
}]

export function ActionDecode(props: { action: FlatTransaction, state: { loading: boolean, state?: AccountStatus }}) {
  const { action, state } = props

  const hasCall = action.data && action.data.length >= 10
  const hasValue = action.value && action.value !== "0"

  const data = action.data?.toLowerCase() || "0x"
  const updateImageHash = data.startsWith(updateImageHashSelector) || data.startsWith("0x" + updateImageHashSelector)
  const decoded = useFunctionSignature(action.data?.slice(0, 10) || "0x")

  const warning = warningMethods.find(w => data.startsWith(w.selector) || data.startsWith("0x" + w.selector))

  return <Box m="md" style={{
    fontSize: '12px', fontFamily: 'Courier New, monospace'
  }}>
    {warning && <Box mt="md" style={{ color: "red" }}>
      WARNING! Transaction is a <b>{warning.name}</b> method, this method is not natively supported by the Enchanter. Be careful!<br/>
      <b>This transaction may be used to take control of the Wallet.</b>
    </Box>}
    {!hasValue && !hasCall && <Box mt="md">
      Calls {action.to} without value or common data
    </Box>}
    {hasValue && <Box mt="md">
      Transfer {ethers.utils.formatEther(action.value || 0)} NATIVE to {action.to}
    </Box>}
    {hasCall && <Box mt="md">
      {decoded.loading && <Loader />}
      {decoded.error && <Box>
        {decoded.error}    
      </Box>}
      {decoded.signature && <Box mt="md">
        Calling <b>{decoded.signature.text_signature}</b> on {action.to}
        <ActionArguments action={action} signature={decoded.signature} />
      </Box>}
    </Box>}
    {updateImageHash && <Box mt="md">
      <ActionUpdateImageHash action={action} state={state} />
    </Box>}
  </Box>
}

export function ActionsDecoded(props: { transaction: TransactionsEntry, state: { loading: boolean, state?: AccountStatus }}) {
  const { transaction, state } = props

  return <>
    <Space h="md" />
    {transaction.transactions.map((action, i) => <Box>
        <Title order={6}>Action #{i}</Title>
        <ActionDecode key={i} action={action} state={state} />
      </Box>
    )}
  </>
}