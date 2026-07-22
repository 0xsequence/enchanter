# Enchanter code map

Use this map to locate current behavior. Inspect the referenced implementation before changing a workflow or calling lower-level SDK APIs.

| Concern | Primary implementation | Executable evidence |
| --- | --- | --- |
| v2/v3 config normalization | `src/stores/Sequence.ts`: `normalizeV2`, `normalizeV3`, `accountStateFor` | `tests/e2e/protocol-flows.spec.ts` |
| Wallet creation | `src/stores/Sequence.ts`: `noNesting`, `createSequenceWallet`; `src/sections/Create.tsx` | WAL-01..08 in `tests/FLOWS.md` |
| Local wallet list/import | `src/stores/db/Wallets.ts`, `src/sections/Home.tsx`, `ImportWallet.tsx` | WAL-06..07 |
| v3 Key Machine RPC | `src/stores/KeyMachine.ts`: `keyMachineRpc`, payload serializers, `publishSignature`, `lookupKeyMachine` | `keymachine-sync.spec.ts` |
| Witness publish/discovery | `src/stores/Witness.ts`; witness button in `src/sections/Wallet.tsx` | witness test in `keymachine-sync.spec.ts` |
| Signature mailbox | `src/stores/Mailbox.ts` | Key Machine restore/sync tests |
| Local signature recovery | `src/helpers/signatures.ts`; `useRecovered` in `Sequence.ts` | authorization-state tests |
| Transaction composition | `src/sections/Send.tsx`; payload helpers in `Sequence.ts`, `db/Transactions.ts` | TX flows in `tests/FLOWS.md` |
| Transaction signing/execution | `src/sections/Transaction.tsx` | protocol, authorization, funded tests |
| Message creation/signing | `src/sections/Sign.tsx`, `Message.tsx` | MSG flows |
| Signer update proposal | `src/sections/Update.tsx`; `Sequence.ts`: `updateAccount` | UP-01..03 |
| Update signing/publication | `src/sections/UpdateDetail.tsx` | UP-02..05 |
| Per-chain update commit | `src/sections/Send.tsx` commit switch and transaction decoration | UP-06 funded test |
| Portable JSON | `src/stores/Exporter.ts`, import/export providers | DATA flows |
| Receipts/nonces | `src/helpers/receipts.ts`, `src/stores/db/Receipts.ts`, `Sequence.ts`: `useReceipt` | TX-12 and funded tests |
| Browser DB schema | `src/stores/db/Main.ts` | clear/restore helpers in `tests/e2e/helpers/app.ts` |
| Browser automation | `tests/e2e/helpers/app.ts`, `fixtures/wallet.ts` | all Playwright specs |

## Pinned SDK boundaries

- v2: `@0xsequence/account`, `@0xsequence/core`, `@0xsequence/sessions`, `@0xsequence/signhub` at the versions resolved by `pnpm-lock.yaml`.
- v3: `@0xsequence/wallet-core` and `@0xsequence/wallet-primitives` 3.0.12 in `package.json`.
- EOA/browser integration: wagmi, viem, ethers 6.

Useful installed source:

- `node_modules/@0xsequence/wallet-core/src/wallet.ts`
- `node_modules/@0xsequence/wallet-core/src/state/sequence/index.ts`
- `node_modules/@0xsequence/wallet-primitives/src/config/`

Do not copy generic latest-version SDK examples into this repository without reconciling them with these pinned APIs and the tests.
