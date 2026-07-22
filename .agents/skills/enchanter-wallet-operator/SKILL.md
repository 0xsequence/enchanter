---
name: enchanter-wallet-operator
description: Operate Sequence Enchanter smart-contract wallets safely from end to end. Use for autonomous or multi-step Enchanter work involving wallet creation or import, v2/v3 state inspection, signer discovery, witnesses, transactions, messages, signature collection, portable data, deployments, signer updates or rotations, and on-chain execution.
---

# Enchanter Wallet Operator

Use Enchanter as a stateful multisig coordinator, not as a key store. Separate local browser records, public Sequence service state, signer authorization, and per-chain execution at every step.

## Load the right context

Read [references/security.md](references/security.md) before any signature, remote write, funded test, deployment, transaction, or configuration change.

Then read only what the task needs:

- [references/architecture.md](references/architecture.md) for the v2/v3 model, state surfaces, witnesses, signatures, and update lifecycle.
- [references/workflows.md](references/workflows.md) for exact UI and automation procedures.
- [references/code-map.md](references/code-map.md) before changing implementation code or when UI behavior and documentation disagree.
- [references/testing.md](references/testing.md) before creating test wallets or running Playwright.
- [references/troubleshooting.md](references/troubleshooting.md) after an unexpected state or service error.

Use the focused sibling skills when the request is narrow: `$enchanter-create-wallet`, `$enchanter-find-wallets`, `$enchanter-update-signers`, `$enchanter-rotate-signers`, or `$enchanter-witnesses`.

## Classify the operation

1. **Read-only** — inspect local wallet records, public configuration, signers, thresholds, checkpoints, pending updates, receipts, or witnessed wallets.
2. **Public off-chain write** — create a counterfactual wallet configuration, publish a witness, payload, signature, or approved configuration update to Sequence services. These writes are durable and discoverable even though they spend no gas.
3. **On-chain write** — deploy, transfer funds or assets, execute a payload, or commit a configuration on a selected network. Confirm the exact wallet, chain, calls, value, signer policy, and funding source before signing or submitting.

Never let authorization for one class silently authorize a more consequential class.

## Run the operator loop

1. Resolve the wallet by checksummed address. Treat names as browser-local labels only.
2. Load and record the protocol version, threshold, signer weights, checkpoint, image hash, deployment state, and pending updates.
3. Identify the requested end state and the exact state transition required. For writes, show or record the diff before collecting signatures.
4. Verify that the connected account is an active signer for signing. Do not confuse the connected transaction broadcaster with a signer.
5. Collect signatures from the configuration that authorizes the payload. Enchanter rejects a duplicate signature and ignores signatures from non-signers when computing weight.
6. Verify recovered signer weight meets the current threshold. A displayed percentage above 100% is valid when signer weight exceeds the threshold.
7. Execute only on the intended chain. A chain-0 payload is portable to all networks but still executes on the currently connected network.
8. Wait for the receipt or durable service confirmation. Classify the result as pending, executed, failed, replaced, consumed, stale, or past rather than assuming success from a submitted hash.
9. Reload state independently and compare address, version, checkpoint, image hash, signer set, and pending-update count with the intended result.
10. Export portable data when another device or signer needs the payload. Do not export private keys; Enchanter exports operations and signatures.

## Prefer supported surfaces

- Use the Enchanter UI and its Playwright helpers for signing and execution. They implement the repository's v2/v3 signature formats, network switching, signature mailbox, receipt tracking, and configuration decoration.
- Use `scripts/find-wallets.mjs` for a read-only signer-to-wallet lookup and `scripts/inspect-wallet.mjs` for normalized public wallet state from the repository root.
- Use `scripts/create-test-wallets.mjs` only for throwaway, unfunded service-level fixtures. It never deploys or broadcasts a blockchain transaction.
- Inspect the implementation before inventing a direct SDK call. v2 and v3 use different services and signing formats.

## Stop conditions

Stop before signing or submission when any of these is unresolved:

- the wallet address or protocol version is ambiguous;
- the requested network, calls, value, or funding source is ambiguous;
- a signer address cannot be independently derived from its key or device;
- the current configuration cannot authorize the update;
- the proposed configuration cannot reach its own threshold without a signer being removed;
- the update shown in Enchanter differs from the approved signer/threshold diff;
- a supposedly pending update is stale or the checkpoint changed during collection;
- the action would use a production key in a test flow or a test key for real funds.

## Report completion

Return the wallet address, protocol version, chain, operation identifier (subdigest and transaction hash when applicable), before/after checkpoint and image hash, signer/threshold diff, recovered signing weight, and final observed status. Never include private keys, mnemonics, raw secret-store data, or full test artifacts.
