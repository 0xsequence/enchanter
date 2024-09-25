import { useState, useEffect } from "react";
import {
  Button,
  Card,
  Flex,
  Group,
  Loader,
  Input,
  NativeSelect,
  Stack,
  Text,
  NumberInput,
  Box,
  Image,
  ActionIcon,
} from "@mantine/core";
import {
  IconTrash,
  IconSearch,
  IconPlus,
  IconMinus,
} from "@tabler/icons-react";
import { SequenceIndexer } from "@0xsequence/indexer";
import { notifications } from "@mantine/notifications";
import { NetworkConfig } from "@0xsequence/network";

type TokenContract = {
  address: string;
  name: string;
};

type NFT = {
  id: string;
  name: string;
  image: string | undefined;
  balance: number;
  amount: number;
  contractAddress: string;
  isERC721: boolean;
};

export type Recipient = {
  address: string;
  selectedContract: string | undefined;
  searchQuery: string;
  foundNFTs: NFT[];
  selectedNFTs: NFT[];
  loadingNFTs: boolean;
};

export default function TransferNFTs(args: {
  chain: NetworkConfig | undefined;
  wallet: string;
  sendNFTs: (recipients: Recipient[]) => void;
}) {
  const [client, setClient] = useState<SequenceIndexer>();
  const [tokenContracts, setTokenContracts] = useState<TokenContract[]>([]);
  const [contractsFetched, setContractsFetched] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([
    {
      address: "",
      selectedContract: undefined,
      searchQuery: "",
      foundNFTs: [],
      selectedNFTs: [],
      loadingNFTs: false,
    },
  ]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (error) {
      notifications.show({
        title: "Error",
        message: error,
        color: "red",
      });
    }
  }, [error]);

  useEffect(() => {
    if (args.chain) {
      setClient(
        new SequenceIndexer(
          `https://${args.chain.name}-indexer.sequence.app`,
          "AQAAAAAAAHmOxjvuWNaoKDFuO5squXWmanI"
        )
      );
      setContractsFetched(false);
      setRecipients([
        {
          address: "",
          selectedContract: undefined,
          searchQuery: "",
          foundNFTs: [],
          selectedNFTs: [],
          loadingNFTs: false,
        },
      ]);
    }
  }, [args]);

  useEffect(() => {
    const fetchTokenContracts = async () => {
      if (client && !contractsFetched) {
        try {
          const result = await client.getTokenBalances({
            includeMetadata: true,
            accountAddress: args.wallet,
          });

          const filteredBalances = result.balances.filter(
            (token) =>
              token.contractType === "ERC721" ||
              token.contractType === "ERC1155"
          );

          const fetchedTokens: TokenContract[] = filteredBalances.map(
            (token) => ({
              address: token.contractAddress,
              name: token.contractInfo?.name ?? "Unknown",
            })
          );

          setTokenContracts(fetchedTokens);
        } catch (error) {
          setError(JSON.stringify(error));
        } finally {
          setContractsFetched(true);
        }
      }
    };
    fetchTokenContracts();
  }, [client, tokenContracts, args, contractsFetched]);

  const resetNFTs = async (recipientIndex: number) => {
    const newRecipients = [...recipients];
    newRecipients[recipientIndex] = {
      ...newRecipients[recipientIndex],
      loadingNFTs: true,
      foundNFTs: [],
    };
    console.log(newRecipients);
    setRecipients(newRecipients);
  };

  const searchNFT = async (recipientIndex: number) => {
    if (!client) return;
    try {
      resetNFTs(recipientIndex);
      const recipient = recipients[recipientIndex];
      const result = await client.getTokenBalances({
        includeMetadata: true,
        accountAddress: args.wallet,
        contractAddress: recipient.selectedContract,
        tokenID: recipient.searchQuery,
      });

      const fetchedTokens = result.balances.map((token) => ({
        id: token.tokenID ?? "0",
        name: token.tokenMetadata?.name ?? `#${token.tokenID}`,
        image: token.tokenMetadata?.image,
        balance: Number(token.balance),
        amount: 1,
        contractAddress: token.contractAddress,
        isERC721: token.contractType === "ERC721",
      }));

      updateRecipient(recipientIndex, "foundNFTs", fetchedTokens);
    } catch (error) {
      setError(JSON.stringify(error));
    }
  };

  const addRecipient = () => {
    setRecipients([
      ...recipients,
      {
        address: "",
        selectedContract: undefined,
        searchQuery: "",
        foundNFTs: [],
        selectedNFTs: [],
        loadingNFTs: false,
      },
    ]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = <K extends keyof Recipient>(
    index: number,
    field: K,
    value: Recipient[K]
  ) => {
    const newRecipients = [...recipients];
    newRecipients[index] = {
      ...newRecipients[index],
      [field]: value ?? undefined,
    };
    setRecipients(newRecipients);
  };

  const updateNfts = <K extends keyof NFT>(
    recipientIndex: number,
    index: number,
    field: K,
    value: NFT[K]
  ) => {
    const newNfts = [...recipients[recipientIndex].selectedNFTs];
    newNfts[index] = {
      ...newNfts[index],
      [field]: value,
    };
    updateRecipient(recipientIndex, "selectedNFTs", newNfts);
  };

  const toggleNFTSelection = (recipientIndex: number, nft: NFT) => {
    const newRecipients = [...recipients];
    const recipient = newRecipients[recipientIndex];
    const nftIndex = recipient.selectedNFTs.findIndex(
      (selectedNFT) => selectedNFT.id === nft.id
    );

    if (nftIndex > -1) {
      recipient.selectedNFTs.splice(nftIndex, 1);
    } else {
      recipient.selectedNFTs.push(nft);
    }

    setRecipients(newRecipients);
  };

  return (
    <Stack>
      {recipients.map((recipient, index) => (
        <Card key={index} shadow="sm" p="lg" radius="md" withBorder>
          <Stack>
            <Group>
              <Input
                placeholder="Recipient Address"
                value={recipient.address}
                onChange={(e) =>
                  updateRecipient(index, "address", e.currentTarget.value)
                }
                aria-label={`Recipient ${index + 1} Address`}
                style={{ flex: 1 }}
              />
              <Button
                color="red"
                variant="light"
                onClick={() => removeRecipient(index)}
                aria-label={`Remove Recipient ${index + 1}`}
              >
                <IconTrash size={16} />
              </Button>
            </Group>
            <Group>
              <NativeSelect
                data={[
                  { label: "Select token", value: "" },
                  ...tokenContracts.map((token) => {
                    return { label: `${token.name !== "" ? token.name : "unknown"} (${token.address})`, value: token.address };
                  }),
                ]}
                style={{ flex: 1 }}
                value={recipient.selectedContract}
                onChange={(event) =>
                  updateRecipient(index, "selectedContract", event.target.value)
                }
              />

              {recipient.selectedContract && (
                <>
                  <Input
                    style={{ maxWidth: 80 }}
                    placeholder="Token Id"
                    value={recipient.searchQuery}
                    onChange={(e) =>
                      updateRecipient(
                        index,
                        "searchQuery",
                        e.currentTarget.value
                      )
                    }
                  />
                  <Button
                    disabled={recipient.loadingNFTs}
                    variant="light"
                    onClick={() => searchNFT(index)}
                  >
                    <IconSearch size={16} />
                  </Button>
                </>
              )}
            </Group>
            <Stack align="center">
              {recipient.foundNFTs.length > 0 && (
                <>
                  {recipient.foundNFTs.map((nft) => {
                    const isAdded = recipient.selectedNFTs.some(
                      (selectedNFT) => selectedNFT.id === nft.id
                    );
                    return (
                      <Card padding="xs" key={nft.id} shadow="sm" withBorder>
                        <Box style={{ position: "relative" }}>
                          <Image
                            src={nft.image}
                            h={80}
                            w={80}
                            fallbackSrc={`https://placehold.co/80x80?text=${nft.id}`}
                          />
                          <ActionIcon
                            color="gray.0"
                            variant="filled"
                            onClick={() => toggleNFTSelection(index, nft)}
                            aria-label={isAdded ? "Remove" : "Add"}
                            style={{
                              position: "absolute",
                              top: "-8px",
                              right: "-8px",
                              zIndex: 1,
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}
                            size="sm"
                          >
                            {isAdded ? (
                              <IconMinus size="1rem" color="black" />
                            ) : (
                              <IconPlus size="1rem" color="black" />
                            )}
                          </ActionIcon>
                        </Box>

                        <Text size="sm">{nft.name}</Text>
                      </Card>
                    );
                  })}
                </>
              )}
              {recipient.loadingNFTs && <Loader color="blue" />}
            </Stack>
            {recipient.selectedNFTs.length > 0 && (
              <Stack>
                <Text size="sm">Selected NFTs</Text>
                {recipient.selectedNFTs.map((nft, nftIndex) => (
                  <Card
                    shadow="sm"
                    padding={0}
                    withBorder
                    style={{
                      width: "150px",
                      overflow: "visible",
                      position: "relative",
                    }}
                  >
                    <ActionIcon
                      color="gray.0"
                      variant="filled"
                      onClick={() => toggleNFTSelection(index, nft)}
                      aria-label="Remove"
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        zIndex: 2,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                      size="sm"
                    >
                      <IconMinus size="1rem" color="black" />
                    </ActionIcon>
                    <Flex>
                      <Box
                        style={{
                          position: "relative",
                          width: "80px",
                          height: "80px",
                        }}
                      >
                        <Image
                          src={nft.image}
                          style={{
                            objectFit: "cover",
                            width: "100%",
                            height: "100%",
                          }}
                          fallbackSrc={`https://placehold.co/80x80?text=${nft.id}`}
                        />
                      </Box>
                      <Flex
                        direction="column"
                        justify="center"
                        style={{ width: "80px", padding: "5px" }}
                      >
                        <Text size="sm" mb="xs">
                          {nft.name}
                        </Text>
                        <NumberInput
                          value={nft.amount}
                          onChange={(value) =>
                            updateNfts(index, nftIndex, "amount", Number(value))
                          }
                          min={1}
                          max={nft.balance}
                          styles={{
                            input: { textAlign: "center", height: "30px" },
                          }}
                          aria-label="Amount"
                        />
                      </Flex>
                    </Flex>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      ))}
      <Group justify="flex-end" mt="md">
        <Button variant="light" onClick={addRecipient}>
          Add recipient
        </Button>
        <Button onClick={() => args.sendNFTs(recipients)}>Submit</Button>
      </Group>
    </Stack>
  );
}
