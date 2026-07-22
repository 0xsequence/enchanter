# Enchanter operating workflows

## Contents

- [Run Enchanter](#run-enchanter)
- [Create a wallet](#create-a-wallet)
- [Find and import wallets](#find-and-import-wallets)
- [Inspect wallet state](#inspect-wallet-state)
- [Publish a witness](#publish-a-witness)
- [Create and execute a transaction](#create-and-execute-a-transaction)
- [Sign a message](#sign-a-message)
- [Update signers](#update-signers)
- [Rotate a signer](#rotate-a-signer)
- [Export and import portable data](#export-and-import-portable-data)
- [Acceptance checklist](#acceptance-checklist)

## Run Enchanter

From the repository root:

```sh
pnpm install
pnpm dev --host 0.0.0.0
```

The default development port is 5174. For automation, prefer the repository Playwright configuration, which starts Vite on port 4175 and uses its own browser profile.

The hosted app is `https://0xsequence.github.io/enchanter/`. Prefer a local checkout when inspecting behavior or running tests so it matches the source under review.

## Create a wallet

1. Open **Create wallet** (`/#/create-wallet`).
2. Enter a **Name (local only)**.
3. Choose **Sequence protocol**. v3 is the default for new wallets; select v2 only for an explicit compatibility reason.
4. Enter **Threshold**.
5. Enter a **Salt** in `0..2147483647`, or keep the time-derived default. Treat it as the initial checkpoint.
6. Enter each signer **Address** and **Weight**; add/remove rows as needed.
7. Verify full addresses, unique signers, total weight, usable signer combinations, and non-nesting.
8. Submit **Create** and wait for **Wallet created**.
9. Record the resulting route address, then reload the Wallet view and verify version, threshold, signers, checkpoint, and image hash.

Creation saves public config state but sends no chain transaction. Do not treat the local name as portable metadata.

## Find and import wallets

### Known address

1. Open **Import wallet** (`/#/import-wallet`).
2. Enter a local-only name and checksummed wallet address.
3. Submit **Import**.
4. Enchanter resolves v3 then v2, validates status, and stores the detected version locally.
5. If **Wallet already exists** appears, open the existing row rather than creating a duplicate label.

### Known signer

1. Connect the signer EOA.
2. Open **My wallets**.
3. Wait for **Detected wallets**. Each result comes from v3 Key Machine or v2 tracker witness lookup.
4. For each candidate, open/inspect current state and verify the signer is still present.
5. Select **Add** only after validation. This creates a generated local name and imports no key.

CLI read-only equivalent:

```sh
node .agents/skills/enchanter-wallet-operator/scripts/find-wallets.mjs 0xSIGNER
```

### Known v3 subdigest

Open one of:

- `/#/transaction/0xSUBDIGEST`
- `/#/message/0xSUBDIGEST`
- `/#/do-update/0xSUBDIGEST`

If absent locally, Enchanter asks the Key Machine for a representable v3 payload. After restore, it polls the signature mailbox while threshold is unmet. A v2 payload requires an export/import rather than Key Machine payload lookup.

## Inspect wallet state

Open `/#/wallet/0xADDRESS` and record:

- local name, if any;
- checksummed address;
- Sequence v2 or v3;
- threshold and signer count;
- signer addresses and weights;
- checkpoint;
- deployment status from relevant chain-specific screens;
- pending update count when building a transaction.

Use Delphiview only as a supplementary visualization. Enchanter's pinned SDK state and the wallet contract/RPC are the operational sources.

For a read-only machine-readable snapshot from the repository root:

```sh
node .agents/skills/enchanter-wallet-operator/scripts/inspect-wallet.mjs 0xWALLET
node .agents/skills/enchanter-wallet-operator/scripts/inspect-wallet.mjs 0xWALLET --version 3
node .agents/skills/enchanter-wallet-operator/scripts/inspect-wallet.mjs 0xWALLET --version 2 --chain-id 137
```

Auto mode tries v3 and then v2. A v3 snapshot without an RPC provider reports public service state but makes no chain-specific deployment claim; v2 status uses the selected chain ID.

## Publish a witness

1. Open the Wallet view and connect a current signer.
2. Wait for witness status to resolve. **Sign witness** remains disabled for a non-signer or an already witnessed signer.
3. Inspect and approve the v2 message-sign or v3 typed-data request.
4. Wait for **Witness published**.
5. Verify through a clean/local-forgotten wallet list or `find-wallets.mjs` that the signer lookup returns the address.
6. Reload the wallet and independently verify current membership; discovery alone is historical.

## Create and execute a transaction

1. Open **Send Transaction** (`/#/new-transaction/0xWALLET`).
2. Select a concrete network or **All networks**.
3. Review the default **Commit pending wallet updates** switch. Leave it enabled only when approved updates should be activated with this execution.
4. Add raw calls or compose function/NFT actions. For each call verify target, integer wei value, calldata, gas limit if present, delegate-call flag, and revert behavior.
5. Submit to stage the payload. Record the subdigest, chain ID, space, nonce, and decoded actions.
6. Each current signer opens the same detail via Key Machine URL, export/import, or shared browser data and selects **Sign transaction**.
7. Wait for recovered weight to meet threshold. Mailbox polling may sync co-signer signatures every 10 seconds.
8. Connect a broadcaster on the execution network. Select **Execute transaction**.
9. Record the outer transaction hash and wait for **Executed**, **Failed**, **Replaced**, or other resolved receipt state.

For chain-0, the same signed payload can be executed on a chosen connected network. Ensure that is intended and do not replay unintentionally.

## Sign a message

1. Open `/#/sign-message/0xWALLET`.
2. Enter the exact message and chain; distinguish UTF-8 input from raw hex input.
3. Submit and record message, digest, subdigest, and chain.
4. Collect signatures from current signers. v3 uses typed data; v2 signs the subdigest.
5. Verify threshold status. For undeployed wallets expect ERC-6492 validation; after deployment expect ERC-1271.
6. Export the message and signatures when another device or verifier needs them.

## Update signers

1. Snapshot current wallet state and target networks.
2. Open **Update Signers** (`/#/update/0xWALLET`).
3. Enter the complete desired threshold and signer list—not only the delta.
4. Review **UpdateDiff** and confirm proposed checkpoint `current + 1`.
5. Submit **Update** and record image hash/subdigest.
6. On **Update Detail**, collect **Sign change** approvals from current signers until current threshold is met.
7. Select **Execute change**. For v3 this submits a signed update to the state provider; for v2 it publishes through the account/tracker path.
8. Build a transaction on each intended deployed chain with **Commit pending wallet updates** enabled.
9. Review the added config transition, collect transaction signatures, execute, wait for receipt, and reload state.
10. Verify exact checkpoint, image hash, threshold, signers, weights, and no unexpected pending update.

## Rotate a signer

### Planned two-step rotation

1. Create and independently verify replacement key/device and address.
2. Use [Update signers](#update-signers) to add it while retaining a valid old quorum.
3. Commit and verify on active chains.
4. Connect the replacement, publish a witness, and sign a harmless payload to prove usability.
5. Use [Update signers](#update-signers) again to remove the old signer.
6. Commit and verify everywhere, then retire the old key under the applicable key policy.

### Compromise rotation

1. Determine whether trusted current signer weight reaches current threshold.
2. If yes, build one atomic complete config removing the compromised signer and adding a replacement verified in advance.
3. Collect trusted approvals, publish, commit, and verify promptly across active chains.
4. If no, stop and use external recovery/governance; Enchanter cannot bypass the existing threshold.

## Export and import portable data

The **Export data** action produces JSON containing the relevant transactions, messages, updates, and signatures. It does not include the wallet list, local names, or private keys.

1. Export from the detail page after staging or signing.
2. Transfer over an approved channel. Treat the payload as public transaction intent plus signatures, not as secret-key material.
3. On the other device select global **Import Data**, paste/upload JSON, and submit.
4. Verify notifications for each record class and deduplication behavior.
5. Reopen by subdigest and verify all fields and recovered signing weight.

## Acceptance checklist

For any mutating workflow, finish only after:

- address and protocol version are unambiguous;
- current state was loaded immediately before the action;
- signer/threshold or call diff was reviewed;
- recovered signers and total weight were verified;
- service publication or transaction receipt was observed;
- final state was independently reloaded;
- chain-specific claims name the chain;
- no secret appeared in source, logs, exports, screenshots, or the final report.
