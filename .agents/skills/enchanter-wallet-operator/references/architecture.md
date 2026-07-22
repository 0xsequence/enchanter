# Enchanter wallet architecture

## Contents

- [Wallet identity and configuration](#wallet-identity-and-configuration)
- [Protocol versions](#protocol-versions)
- [State surfaces](#state-surfaces)
- [Creation and deployment](#creation-and-deployment)
- [Signatures and thresholds](#signatures-and-thresholds)
- [Configuration updates](#configuration-updates)
- [Witnesses and discovery](#witnesses-and-discovery)
- [Portable operations and mailbox sync](#portable-operations-and-mailbox-sync)
- [Receipts and execution state](#receipts-and-execution-state)
- [Authoritative sources](#authoritative-sources)

## Wallet identity and configuration

An Enchanter wallet is a Sequence counterfactual smart-contract wallet. Its initial configuration determines a deterministic address. The address can be used before deployment and is consistent across compatible EVM networks for the same contract context.

The simple weighted-multisig configuration contains:

- a threshold (`uint16`, 1–65535);
- signer addresses;
- a weight per signer (`uint8`, 0–255 at protocol level; use positive weights operationally);
- a checkpoint, called **Salt** in the creation form;
- for v3, a signer topology tree that Enchanter builds from flat signer leaves.

Signer weight counts only when a valid signature recovers to a signer in the configuration that authorizes the payload. Any combination whose summed weight reaches the threshold can authorize. Extra weight is allowed, so UI progress can exceed 100%.

The initial configuration, context, and checkpoint determine the wallet address. Later configuration updates change the image hash and checkpoint but not the wallet address. Names are never part of the wallet; Enchanter stores them only in the current browser.

Enchanter rejects a signer that resolves as a Sequence v2 or v3 wallet because nested Sequence wallet signing is not implemented here.

## Protocol versions

| Concern | Sequence v2 | Sequence v3 in this repository |
| --- | --- | --- |
| Creation API | `@0xsequence/account` `Account.new` | `@0xsequence/wallet-core` `Wallet.fromConfiguration` |
| Contract context | Sequence default v2 contexts | `Context.Rc5` |
| Public state service | sessions remote config tracker | Sequence state provider / Key Machine |
| Default signing | `personal_sign`-style signature over subdigest | EIP-712 typed payload whose hash is the subdigest |
| Stored signature tag | `02` for EthSign | `01` for typed/hash, untagged or `02` for EthSign compatibility |
| Proposed update | save complete config to tracker | save target config and prepare config-update envelope |
| Approved update | `Account.updateConfig` publishes a presigned configuration | `Wallet.submitUpdate` saves the threshold-approved update |
| Payload recovery by subdigest | local export/import | Key Machine lookup for representable calls, messages, and config updates |

When an imported wallet has no pinned version, `accountStateFor` tries v3 and then v2. Once known, preserve the version; selecting another version during creation does not migrate an existing address.

## State surfaces

### Browser-local state

IndexedDB database `sequence-enchanter`, schema version 4, stores:

- wallets: local name, address, and optional protocol version;
- transactions, messages, and updates;
- individual signatures keyed by subdigest;
- durable execution receipts.

Clearing browser data can remove all of this. It does not delete public service records or on-chain state. Wallet names never synchronize.

### Public Sequence service state

- v2 config and witness data use `https://sessions.sequence.app` through `RemoteConfigTracker`.
- v3 state and payload data use the wallet-core Sequence provider and `https://keymachine.sequence.app`.
- v3 payload URLs can be portable because the Key Machine stores payloads keyed by digest.
- the signature mailbox uses Key Machine witness enumeration as transport.

These services are not secret stores. Configurations, payloads, signatures, and witnesses sent to them should be treated as durable public coordination data.

### Per-chain state

Each EVM network has deployment bytecode, wallet nonce, execution events, and—after configuration commits—an on-chain image hash or update stage. A wallet may be deployed or updated on one chain and counterfactual or behind on another. Always state the chain when claiming deployment, execution, or committed configuration.

## Creation and deployment

Creation validates signer non-nesting, selects a checkpoint, builds a config, saves it to the version's state service, verifies it can be read back, and returns the deterministic address. No blockchain transaction is sent.

Deployment is a separate funded action. Enchanter can also execute the first wallet transaction from its counterfactual state through the protocol's decorated entrypoint, depending on version and chain state. A wallet can receive funds at its address before deployment, but spending requires a valid signed execution.

The UI defaults to v3. Use v2 only for a concrete compatibility need. A custom salt is useful for deterministic recreation, but reusing an identical complete initial configuration reproduces an existing address rather than creating a new wallet.

## Signatures and thresholds

A subdigest binds the wallet, chain ID, and payload. Chain ID 0 denotes an all-networks payload; execution still occurs on a concrete connected network.

Enchanter:

1. recovers signer addresses from each stored signature;
2. matches recovered addresses against current signers;
3. sums their configured weights;
4. enables execution only at or above threshold.

For v3, transactions and updates are presented as typed data. A chain-specific v3 transaction switches the connected wallet to the payload chain before requesting the signature. For v2, Enchanter requests a message signature over raw subdigest bytes and adds the protocol signature type suffix.

The connected EOA has two possible roles:

- **signer**: must be in the current wallet config to add authorizing weight;
- **broadcaster/executor**: pays gas and submits the encoded wallet call, but need not itself be an authorizing signer after the threshold signatures are assembled.

Never conflate these roles.

## Configuration updates

An update is authorized by the **current** configuration and proposes a complete **next** configuration at checkpoint `current + 1`.

The lifecycle has two layers:

1. **Off-chain approval/publication**
   - Create the next config and its image hash.
   - Sign the update subdigest with current signers until current threshold is met.
   - v2 publishes a presigned config chain to the tracker.
   - v3 submits a signed update envelope to the state provider. The Key Machine signature call must include `toConfig`; a config-update payload without its target config can break restoration.
2. **Per-chain commit**
   - Build a transaction with **Commit pending wallet updates** enabled.
   - v2 decorates the actions in advance with pending update transitions.
   - v3 `prepareTransaction` includes the config update unless `noConfigUpdate` is true. For chain-0 payloads Enchanter appends an `updateImageHash` self-call.
   - Sign and execute the transaction on the intended network, then verify the on-chain/current status.

The update detail's **Execute change** completes the first layer. The funded end-to-end test explicitly creates a second transaction with commit enabled to complete the on-chain layer.

A proposal is **Pending** when its checkpoint is greater than the currently loaded checkpoint and **Stale** otherwise. Stale can mean the proposal became current or another update advanced the wallet; compare image hashes and full configs.

## Witnesses and discovery

A witness links a signer to a wallet in public service state so reverse lookup can answer “which wallets has this signer witnessed?”

For v2, Enchanter follows the Sequence `publishWitness` convention: it creates a timestamped digest, computes a chain-0 wallet subdigest, asks the signer for a message signature, appends `02`, and calls tracker `saveWitnesses`.

For v3, Enchanter creates JSON with action `enchanter-witness`, a human-readable statement, wallet, signer, and timestamp; wraps it as a chain-0 message payload; requests EIP-712 typed signing; and calls `SaveSignerSignatures3`.

Signing a transaction through Enchanter can create a witness as a side effect. An explicit witness covers a signer who has not yet signed an operation.

Discovery unions:

- v3 `KeyMachine/Wallets`, up to five pages of 100;
- v2 `TRACKER.walletsOfSigner`.

It checksums, deduplicates, and filters wallets already present locally. A witness is historical evidence, not guaranteed current signer membership; always reload the configuration.

## Portable operations and mailbox sync

Transactions, messages, updates, and their signatures can be exported as JSON and imported on another device. Wallet list entries and local names are separate.

For v3, a missing detail route can query the Key Machine by subdigest and restore a payload only when it round-trips to Enchanter's local model. Unsupported call forms are rejected.

The mailbox derives a deterministic ephemeral signer from each subdigest. It posts an envelope containing an inner signer signature as a witnessed message and enumerates that mailbox signer's witnessed entries to retrieve candidates. Anyone can post an envelope, so Enchanter validates signature shape, recovers the signer, deduplicates it, and counts weight only for current wallet signers.

Mailbox sync polls every 10 seconds while the threshold is unmet, up to 500 entries. It is transport, not an authorization oracle.

## Receipts and execution state

Enchanter waits for the outer transaction receipt and derives wallet-level success from wallet events. It distinguishes:

- pending submission;
- executed payload;
- wallet action failure;
- outer transaction revert (the nonce can be retried);
- replaced or consumed nonce;
- unknown result pending later lookup.

Durable receipt records are cached in IndexedDB. A transaction hash is evidence of submission, not success; report the mined receipt and wallet-level status.

## Authoritative sources

- Repository implementation: `src/stores/Sequence.ts`, `KeyMachine.ts`, `Mailbox.ts`, `Witness.ts`, and `src/sections/*.tsx`.
- Repository executable behavior: `tests/FLOWS.md` and `tests/e2e/*.spec.ts`.
- Installed SDK source: `node_modules/@0xsequence/wallet-core/src/wallet.ts` documents `fromConfiguration`, `prepareUpdate`, `submitUpdate`, and `getStatus` for the pinned dependency.
- Sequence wallet configuration reference: https://docs.sequence.xyz/solutions/technical-references/architecture/v1/wallet-configuration
- Sequence tree-based configuration overview: https://docs.sequence.xyz/solutions/wallets/ecosystems/wallet-config

Prefer the pinned repository code and tests when current generic Sequence documentation describes a newer product generation than Enchanter's v2/v3 dependencies.
