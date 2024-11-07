import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  NativeSelect,
  Switch,
  TextInput,
  Textarea,
  Title,
  Radio,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import { useForm, UseFormReturnType } from "@mantine/form";
import { IconTrash } from "@tabler/icons-react";
import { NETWORKS, accountFor, useAccountState } from "../stores/Sequence";
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
import { useEffect, useMemo, useState } from "react";
import { encodeFunctionData } from "viem";
import { commons } from "@0xsequence/core";
import { isErrorWithMessage } from "../helpers/errors";
import TransferNFTs, { Recipient } from "../components/TransferNFTs";

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

export function Send() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const navigate = useNavigate();
  const [sendingNfts, setSendingNfts] = useState(false);

  const title = (
    <>
      <Title order={3} mb="md">
        Send Transaction
      </Title>
    </>
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

  const network = NETWORKS.find(
    (n) => toUpperFirst(n.name) === form.values.network
  );
  const state = useAccountState(address, network?.chainId || 1);
  const pendingUpdates =
    (network && state?.state?.presignedConfigurations?.length) || 0;

  useEffect(() => {
    form.setFieldValue("commitWalletUpdates", pendingUpdates > 0);
  }, [pendingUpdates, form]);

  if (!address || !ethers.isAddress(address)) {
    return (
      <>
        {title}
        Invalid address
      </>
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

    let actions = values.transactions.map((t) => ({
      to: t.to,
      value: BigInt(t.value || "0").toString(),
      data: t.data,
      revertOnError: true,
    })) as commons.transaction.Transactionish;

    if (values.commitWalletUpdates) {
      if (
        state.state === undefined ||
        state.state.presignedConfigurations.length === 0
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
        state.state,
        network.chainId
      );
    }

    const txe: TransactionsEntry = {
      wallet: address,
      space: BigInt(values.space || Math.floor(Date.now())).toString(),
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
    <>
      {title}
      <Box maw={600}>
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
            ]}
            value={form.values.network}
            onChange={(event) =>
              form.setFieldValue("network", event.target.value)
            }
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
            />
          </Group>

          {sendingNfts ? (
            <TransferNFTs
              wallet={address}
              chain={network}
              sendNFTs={sendNFTs}
            />
          ) : (
            <>
              {fields}
              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
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
    </>
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
    if (!abiEncoder) {
      form.setFieldValue(`transactions.${index}.data`, "");
    } else {
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
        <Divider mt="xs" mb="xs" label={"Transaction " + index} />
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
          onChange={() => setAbiEncoder(!abiEncoder)}
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
        <ActionIcon
          color="red"
          onClick={() => form.removeListItem("transactions", index)}
        >
          <IconTrash size="1rem" />
        </ActionIcon>
      </Box>
    </Group>
  );
}
