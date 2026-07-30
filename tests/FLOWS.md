# End-to-end flow inventory

This inventory defines the supported user-flow surface for the Playwright suite. A “flow” is a distinct route, state transition, validation branch, or authorization outcome; it is not every permutation of all EVM networks and input values.

## Coverage levels

- **UI**: deterministic browser behavior and validation.
- **Keymachine**: real Sequence v2 tracker or v3 Keymachine reads/writes.
- **Mocked indexer**: deterministic indexer results, while Enchanter performs the real encoding and persistence.
- **Funded Amoy**: real Polygon Amoy deployment and transactions paid by a dedicated test-only EOA.

## Wallet and application shell

| ID | Flow | Level | Test |
| --- | --- | --- | --- |
| APP-01 | Empty home, global actions, version, and wallet-disabled navigation | UI | `app-shell.spec.ts` |
| APP-02 | Desktop navigation among Home, Create, and Import | UI | `app-shell.spec.ts` |
| APP-03 | Mobile navigation drawer | UI | `app-shell.spec.ts` |
| APP-04 | Connect an injected EIP-1193 wallet | UI | `wallet-connect.spec.ts` |
| WAL-01 | Create form required fields and numeric bounds | UI | `form-validation.spec.ts` |
| WAL-02 | Add/remove weighted signers and reject an underweight threshold | UI | `form-validation.spec.ts` |
| WAL-03 | v3 default and explicit v2 selection | UI | `form-validation.spec.ts` |
| WAL-04 | Create and read a real v2 counterfactual wallet | Keymachine | `protocol-flows.spec.ts` |
| WAL-05 | Create and read a real v3 counterfactual wallet | Keymachine | `protocol-flows.spec.ts` |
| WAL-06 | Persist, list, select, and open a wallet locally | Keymachine | `protocol-flows.spec.ts` |
| WAL-07 | Import validation and duplicate-wallet handling for v2/v3 | UI + Keymachine | `form-validation.spec.ts`, `protocol-flows.spec.ts` |
| WAL-08 | Reject nested Sequence wallet signers | Keymachine | `protocol-flows.spec.ts` |
| WAL-09 | Invalid wallet route and missing record states | UI | `app-shell.spec.ts` |
| WAL-10 | Deploy real v2 and v3 wallets and detect deployed state | Funded Amoy | `funded-amoy.spec.ts` |
| WAL-11 | Add, persist, edit, and remove a local-only signer address label while retaining the full address | Keymachine + UI | `address-labels.spec.ts` |

## Transactions and assets

| ID | Flow | Level | Test |
| --- | --- | --- | --- |
| TX-01 | Validate network, destination, value, and calldata | UI | `form-validation.spec.ts` |
| TX-02 | Add/remove batched raw calls | UI | `form-validation.spec.ts` |
| TX-03 | Encode a function selector and typed arguments; reject malformed ABI | UI | `form-validation.spec.ts` |
| TX-04 | Create, view, list, sign, export, clear, import, and restore a v2 transaction | Keymachine | `protocol-flows.spec.ts` |
| TX-05 | Create, view, list, sign, export, clear, import, and restore a v3 transaction | Keymachine | `protocol-flows.spec.ts` |
| TX-06 | Create all-network v2/v3 payloads | Keymachine | `protocol-flows.spec.ts` |
| TX-07 | Disable execution below threshold and disable duplicate signing | Keymachine | `authorization-states.spec.ts` |
| TX-08 | Disable signing for a connected non-signer | Keymachine | `authorization-states.spec.ts` |
| TX-09 | Disable execution on the wrong connected network | Keymachine | `authorization-states.spec.ts` |
| TX-10 | Compose mixed ERC-721 and ERC-1155 transfers, including ERC-1155 amount | Mocked indexer + Keymachine | `nft-flow.spec.ts` |
| TX-11 | Execute real native-value transfers from v2 and v3 wallets | Funded Amoy | `funded-amoy.spec.ts` |
| TX-12 | Resolve pending execution to an on-chain receipt by wallet event | Funded Amoy | `funded-amoy.spec.ts` |
| TX-13 | Invalid transaction route, missing detail, and empty list | UI | `app-shell.spec.ts` |

## Messages

| ID | Flow | Level | Test |
| --- | --- | --- | --- |
| MSG-01 | Create, view, list, and sign v2/v3 messages | Keymachine | `protocol-flows.spec.ts` |
| MSG-02 | Produce and verify an ERC-6492 signature for an undeployed wallet | Keymachine | `protocol-flows.spec.ts`, `funded-amoy.spec.ts` |
| MSG-03 | Produce and verify an ERC-1271 signature after deployment | Funded Amoy | `funded-amoy.spec.ts` |
| MSG-04 | Export/import messages and their signatures | Keymachine | `protocol-flows.spec.ts` |
| MSG-05 | Keep a partial-threshold message unsigned at wallet level | Keymachine | `authorization-states.spec.ts` |
| MSG-06 | Disable signing for a connected non-signer | Keymachine | `authorization-states.spec.ts` |
| MSG-07 | Invalid route, missing detail, and empty list | UI | `app-shell.spec.ts` |

## Configuration updates

| ID | Flow | Level | Test |
| --- | --- | --- | --- |
| UP-01 | Edit threshold/signers and show the configuration diff | Keymachine | `protocol-flows.spec.ts`, `authorization-states.spec.ts` |
| UP-02 | Create, sign, publish, export, import, and list a v2 update | Keymachine | `protocol-flows.spec.ts` |
| UP-03 | Create, sign, publish, export, import, and list a v3 update | Keymachine | `protocol-flows.spec.ts` |
| UP-04 | Prevent publication below the current threshold | Keymachine | `authorization-states.spec.ts` |
| UP-05 | Distinguish pending and stale/past update states | Keymachine | `protocol-flows.spec.ts` |
| UP-06 | Commit v2 and v3 updates in real wallet transactions | Funded Amoy | `funded-amoy.spec.ts` |
| UP-07 | Invalid route and missing update detail | UI | `app-shell.spec.ts` |

## Portable data and browser boundaries

| ID | Flow | Level | Test |
| --- | --- | --- | --- |
| DATA-01 | Open/close the global import modal | UI | `app-shell.spec.ts` |
| DATA-02 | Reject malformed JSON and structurally invalid payloads | UI | `form-validation.spec.ts` |
| DATA-03 | Accept an empty payload without duplicating data | UI | `form-validation.spec.ts` |
| DATA-04 | Load import content from a JSON file | UI | `form-validation.spec.ts` |
| DATA-05 | Export transaction/message/update JSON with signatures | Keymachine | `protocol-flows.spec.ts` |
| DATA-06 | Copy exported JSON to the clipboard | UI | `protocol-flows.spec.ts` |
| DATA-07 | Restore all portable record types after clearing their IndexedDB stores | Keymachine | `protocol-flows.spec.ts` |

## Deliberate boundaries

- Polygon Amoy is the funded representative EVM network. The network selector and chain guards are generic; running identical funded cases on every listed chain would duplicate protocol behavior without adding a new application flow.
- NFT discovery is mocked so ERC-721 and ERC-1155 data is stable. The resulting calls use Enchanter’s production ABI encoding and persistence. Native-value transfer, deployment, receipt discovery, and config commits are exercised on-chain.
- Hardware-wallet and browser-extension UIs are outside Enchanter. Tests use an EIP-1193 provider whose private key and signing operations stay in the Playwright Node process.
- Provider outages, rejected signatures, reverts, and failed wallet calls are surfaced by the application’s error notifications, but destructive live-failure injection is not part of the funded smoke path.
