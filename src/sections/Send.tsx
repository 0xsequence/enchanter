import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  NativeSelect,
  Switch,
  Text,
  TextInput,
  Textarea,
  Radio,
} from "@mantine/core";
import { Page, PageHeader } from "../components/Page";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import { useForm, UseFormReturnType } from "@mantine/form";
import { IconTrash } from "@tabler/icons-react";
import { NETWORKS, V3Provider, accountFor, toV3Calls, useAccountState, v3WalletFor } from "../stores/Sequence";
import {
  ParsedFunctionSelector,
  parseFunctionSelector,
  parsedToAbi,
  toUpperFirst,
} from "../Utils";
import { notifications } from "@mantine/notifications";
import {
  TransactionsEntry,
  addTransaction,
  fromSequenceTransactions,
  subdigestOf,
} from "../stores/db/Transactions";
import { publishTransaction } from "../stores/KeyMachine";
import { useEffect, useMemo, useState } from "react";
import { encodeFunctionData } from "viem";
import { commons } from "@0xsequence/core";
import { isErrorWithMessage } from "../helpers/errors";
import TransferNFTs, { Recipient } from "../components/TransferNFTs";
import { isNetworkConfig } from "@0xsequence/network"
import { usePublicClient } from "wagmi";

type TransactionRequest = {
  to: string;
  value: string | undefined;
  data: string | undefined;
};

export type TxEditorProps = {
  form: UseFormReturnType<FormValues>;
  index: number;
};

export type FormValues = {
  network: string;
  commitWalletUpdates: boolean;
  transactions: TransactionRequest[];
};

const AllNetworksOption = "All networks"

export function Send() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const navigate = useNavigate();
  const [sendingNfts, setSendingNfts] = useState(false);

  const title = (
    <PageHeader
      title="Send Transaction"
      description="Stage a transaction for this wallet. Signers approve it before anyone can execute it on-chain."
    />
  );

  const form = useForm({
    initialValues: {
      network: "Select network",
      commitWalletUpdates: false,
      transactions: [
        {
          to: "",
          value: "",
          data: "",
        },
      ] as TransactionRequest[],
    },

    validate: {
      network: (value) => {
        if (value === "Select network") {
          return "Network is required";
        }

        if (value === AllNetworksOption) {
          return;
        }

        const network = NETWORKS.find((n) => toUpperFirst(n.name) === value);
        if (!network) {
          return "Invalid network";
        }
      },
      transactions: {
        to: (value: string) => {
          if (!value) {
            return "To is required";
          }

          return ethers.isAddress(value) ? null : "Invalid address";
        },
        value: (value) => {
          if (isNaN(Number(value))) {
            return "Value should be a number";
          }
        },
        data: (value) => {
          if (value) {
            try {
              ethers.getBytes(value);
            } catch (e) {
              return "Data should be a hex string";
            }
          }
        },
      },
    },
  });

  const sendNFTs = (recipients: Recipient[]) => {
    try {
      const iface = new ethers.Interface([
        "function transferFrom(address from, address to, uint256 tokenId)",
        "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)",
      ]);
      const transactions: TransactionRequest[] = [];
      for (const recipient of recipients) {
        const erc1155Transfers: Record<
          string,
          Array<{ amount: number; id: string }>
        > = {};
        for (const nft of recipient.selectedNFTs) {
          if (nft.isERC721) {
            transactions.push({
              to: nft.contractAddress,
              data: iface.encodeFunctionData("transferFrom", [
                address,
                recipient.address,
                nft.id,
              ]),
              value: "0",
            });
          } else {
            if (!erc1155Transfers[nft.contractAddress]) {
              erc1155Transfers[nft.contractAddress] = [];
            }
            erc1155Transfers[nft.contractAddress].push({
              amount: nft.amount,
              id: nft.id,
            });
          }
        }
        for (const token in erc1155Transfers) {
          const ids = erc1155Transfers[token].map((transfer) => BigInt(transfer.id));
          const amounts = erc1155Transfers[token].map(
            (transfer) => BigInt(transfer.amount)
          );
          transactions.push({
            to: token,
            data: iface.encodeFunctionData("safeBatchTransferFrom", [
              address,
              recipient.address,
              ids,
              amounts,
              "0x",
            ]),
            value: "0",
          });
        }
      }
      if (transactions.length > 0) {
        onSubmit({ ...form.values, transactions, nonce: 0 });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const network = form.values.network === AllNetworksOption ? { chainId: 0 } : NETWORKS.find(
    (n) => toUpperFirst(n.name) === form.values.network
  );
  const state = useAccountState(address, network?.chainId || 1);
  const publicClient = usePublicClient({
    chainId: network?.chainId === 0 ? undefined : network?.chainId,
  })
  const pendingUpdates = (network && state.state?.pendingUpdates) || 0;

  useEffect(() => {
    form.setFieldValue("commitWalletUpdates", pendingUpdates > 0);
  }, [pendingUpdates, form]);

  if (!address || !ethers.isAddress(address)) {
    return (
      <Page>
        {title}
        Invalid address
      </Page>
    );
  }

  const fields = form.values.transactions.map((_, index) => (
    <TxElement key={index} form={form} index={index} />
  ));

  const onSubmit = async (values: {
    commitWalletUpdates: boolean;
    transactions: TransactionRequest[];
    space?: ethers.BigNumberish;
    nonce: ethers.BigNumberish;
  }) => {
    if (!network) return;

    const flatActions = values.transactions.map((t) => ({
      to: t.to,
      value: BigInt(t.value || "0").toString(),
      data: t.data,
      revertOnError: true,
    }));

    if (!state.state) {
      notifications.show({
        title: "Wallet not loaded",
        message: "Wait for the wallet state to load",
        color: "red",
      });
      return;
    }

    const space = BigInt(values.space || Math.floor(Date.now()))

    if (state.state.version === 3) {
      if (network.chainId !== 0 && !publicClient) {
        notifications.show({
          title: "Network unavailable",
          message: "Could not connect to the selected network",
          color: "red",
        });
        return;
      }

      let calls = toV3Calls(flatActions)
      let nonce = BigInt(values.nonce)

      if (network.chainId === 0) {
        if (values.commitWalletUpdates) {
          calls.push({
            to: address as `0x${string}`,
            value: 0n,
            data: encodeFunctionData({
              abi: [{
                type: "function",
                name: "updateImageHash",
                stateMutability: "nonpayable",
                inputs: [{ name: "_imageHash", type: "bytes32" }],
                outputs: [],
              }],
              functionName: "updateImageHash",
              args: [state.state.imageHash as `0x${string}`],
            }),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: "revert",
          })
        }
      } else {
        const envelope = await v3WalletFor(address).prepareTransaction(
          publicClient as V3Provider,
          calls,
          {
            space,
            noConfigUpdate: !values.commitWalletUpdates,
          }
        )
        calls = envelope.payload.calls
        nonce = envelope.payload.nonce
      }

      const txe: TransactionsEntry = {
        version: 3,
        wallet: address,
        space: space.toString(),
        nonce: nonce.toString(),
        chainId: network.chainId.toString(),
        transactions: calls.map((call) => ({
          to: call.to,
          value: call.value.toString(),
          data: call.data,
          gasLimit: call.gasLimit.toString(),
          delegateCall: call.delegateCall,
          revertOnError: call.behaviorOnError === "revert",
        })),
      }

      const subdigest = subdigestOf(txe);
      if (await addTransaction(txe)) {
        publishTransaction(txe);
        notifications.show({
          title: "Transaction created",
          message: subdigest + " added",
          color: "green",
        });
        navigate("/transaction/" + subdigest);
      } else {
        notifications.show({
          title: "Transaction already exists",
          message: subdigest + " already exists",
          color: "red",
        });
      }
      return
    }

    let actions = flatActions as commons.transaction.Transactionish;

    if (values.commitWalletUpdates) {
      if (
        state.state.legacy === undefined ||
        state.state.pendingUpdates === 0
      ) {
        notifications.show({
          title: "No pending updates",
          message: "No pending updates to commit",
          color: "red",
        });
        return;
      }

      const account = accountFor({ address });
      actions = await account.predecorateTransactions(
        actions,
        state.state.legacy,
        network.chainId
      );
    }

    const txe: TransactionsEntry = {
      wallet: address,
      version: 2,
      space: space.toString(),
      nonce: BigInt(values.nonce).toString(),
      chainId: network.chainId.toString(),
      transactions: fromSequenceTransactions(address, actions),
    };

    const subdigest = subdigestOf(txe);
    if (await addTransaction(txe)) {
      notifications.show({
        title: "Transaction created",
        message: subdigest + " added",
        color: "green",
      });
      navigate("/transaction/" + subdigest);
    } else {
      notifications.show({
        title: "Transaction already exists",
        message: subdigest + " already exists",
        color: "red",
      });
    }
  };

  return (
    <Page>
      {title}
      <Box maw={640} className="panel panel-padded">
        <form
          onSubmit={form.onSubmit((values) =>
            onSubmit({ ...values, nonce: 0 })
          )}
        >
          <TextInput
            label="From"
            value={address}
            style={{
              userSelect: "none",
              pointerEvents: "none",
            }}
            mb="md"
            readOnly
          />

          <NativeSelect
            label="Network"
            data={[
              "Select network",
              ...NETWORKS.sort((a, b) => a.chainId - b.chainId).map((n) =>
                toUpperFirst(n.name)
              ),
              AllNetworksOption
              ,
            ]}
            {...form.getInputProps("network")}
            mb="md"
          />

          <Switch
            label={`Commit pending wallet updates (${
              state.loading ? "..." : pendingUpdates
            })`}
            checked={form.values.commitWalletUpdates}
            {...form.getInputProps("commitWalletUpdates")}
            disabled={pendingUpdates === 0}
          />

          <Group style={{ marginTop: 20, marginBottom: 20 }}>
            <Radio
              checked={!sendingNfts}
              onChange={() => setSendingNfts(false)}
              label="Raw transaction"
            />
            <Radio
              checked={sendingNfts}
              onChange={() => setSendingNfts(true)}
              label="Send NFTs"
              disabled={!isNetworkConfig(network)}
            />
          </Group>

          {sendingNfts && isNetworkConfig(network) ? (
            <TransferNFTs
              wallet={address}
              chain={network}
              sendNFTs={sendNFTs}
            />
          ) : (
            <>
              {fields}
              <Divider my="lg" />
              <Group justify="flex-end">
                <Button
                  variant="default"
                  onClick={() =>
                    form.insertListItem("transactions", {
                      to: "",
                      value: "",
                      data: "",
                    })
                  }
                >
                  Add transaction
                </Button>
                <Button type="submit">Submit</Button>
              </Group>
            </>
          )}
        </form>
      </Box>
    </Page>
  );
}

export function TxElement(props: TxEditorProps) {
  const { form, index } = props;

  const [abiEncoder, setAbiEncoder] = useState(false);
  const [functionSelector, setFunctionSelector] = useState("");
  const [functionArgs, setFunctionArgs] = useState<string[]>([]);

  const [abiError, parsedSelector] = useMemo(() => {
    let abiError = "";
    let parsedSelector: ParsedFunctionSelector | undefined = undefined;

    if (abiEncoder && functionSelector.length > 0) {
      try {
        parsedSelector = parseFunctionSelector(functionSelector);
      } catch (e) {
        if (isErrorWithMessage(e) && e.message) {
          abiError = e.message;
        }
      }
    }

    return [abiError, parsedSelector];
  }, [functionSelector, abiEncoder]);

  useEffect(() => {
    if (abiEncoder) {
      form.setFieldValue(`transactions.${index}.data`, "Complete ABI Form");

      if (!parsedSelector) return;

      try {
        const encoded = encodeFunctionData({
          abi: parsedToAbi(parsedSelector),
          functionName: parsedSelector.name,
          args: functionArgs,
        });

        form.setFieldValue(`transactions.${index}.data`, encoded);
      } catch (e) {
        if (isErrorWithMessage(e)) {
          form.setFieldValue(
            `transactions.${index}.data`,
            "Error: " + e.message
          );
        }
      }
    }
  }, [abiEncoder, parsedSelector, functionArgs, form, index]);

  return (
    <Group key={index} mt="xs">
      <Box style={{ width: "100%" }}>
        <Group justify="space-between" mt="md" mb="xs">
          <Text ff="monospace" fz={12} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
            {"Transaction " + index}
          </Text>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={"Remove transaction " + index}
            onClick={() => form.removeListItem("transactions", index)}
          >
            <IconTrash size="1rem" />
          </ActionIcon>
        </Group>
        <TextInput
          label="To"
          placeholder="0x..."
          withAsterisk
          mb="xs"
          {...form.getInputProps(`transactions.${index}.to`)}
        />
        <TextInput
          label="Value (wei)"
          placeholder="0"
          mb="xs"
          {...form.getInputProps(`transactions.${index}.value`)}
        />
        <Textarea
          label="Data"
          placeholder="0x..."
          mb="xs"
          autosize
          minRows={4}
          disabled={abiEncoder}
          {...form.getInputProps(`transactions.${index}.data`)}
        />
        <Switch
          label="Use ABI Encoder"
          checked={abiEncoder}
          onChange={() => {
            const enabled = !abiEncoder;
            setAbiEncoder(enabled);
            if (!enabled) {
              form.setFieldValue(`transactions.${index}.data`, "");
            }
          }}
          mb="xs"
        />
        {abiEncoder && (
          <>
            <TextInput
              label="Function selector"
              placeholder="transfer(address,address,uint256)"
              mb="xs"
              value={functionSelector}
              onChange={(event) =>
                setFunctionSelector(event.currentTarget.value)
              }
              error={abiError}
            />
            {parsedSelector &&
              parsedSelector.inputs.map((input, i) => {
                return (
                  <TextInput
                    key={i}
                    label={`${input.type} (${input.name || i})`}
                    placeholder={input.type}
                    mb="xs"
                    value={functionArgs[i]}
                    onChange={(event) => {
                      const args = [...functionArgs];
                      args[i] = event.currentTarget.value;
                      setFunctionArgs(args);
                    }}
                  />
                );
              })}
          </>
        )}
      </Box>
    </Group>
  );
}
