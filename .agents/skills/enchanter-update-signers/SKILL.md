---
name: enchanter-update-signers
description: Propose, review, sign, publish, commit, and verify Sequence Enchanter signer or threshold configuration changes for v2 and v3 wallets. Use when adding or removing signers, changing signer weights or threshold, collecting update approvals, resolving pending or stale updates, or committing a published configuration on-chain.
---

# Update Enchanter Signers

Treat an update as a lifecycle: **propose → approve with current signers → publish off-chain → commit on each intended chain → verify**. “Update executed” in the update detail means the approved configuration is available to commit; it is not by itself proof of an on-chain commit.

## Preflight

1. Read [security.md](../enchanter-wallet-operator/references/security.md) and the Update procedure in [workflows.md](../enchanter-wallet-operator/references/workflows.md).
2. Reload and record the current version, checkpoint, image hash, threshold, signers, weights, deployment state, and pending updates.
3. Reconcile every existing pending update before creating another proposal. If its intent, checkpoint ordering, or commit status is unknown, stop; do not create a competing update or assume it can be cancelled.
4. Normalize and checksum the desired signer list. Reject duplicates, nested Sequence wallets, unintended zero weights, out-of-range values, and a threshold above total weight.
5. Prove both conditions independently:
   - reachable **current** signer weight can authorize the update;
   - intended **new** signer combinations can authorize future operations.
6. Produce an explicit before/after threshold and signer diff. Confirm it with the user or governing change record before requesting signatures.

## Execute the lifecycle

1. Open **Update Signers**, enter the complete desired configuration, and submit.
2. Verify the proposed checkpoint is exactly current checkpoint + 1 and the displayed diff matches the approved change.
3. Collect approvals from current signers until recovered weight meets the current threshold. v3 uses EIP-712 typed data; v2 signs the subdigest with `personal_sign` semantics.
4. Use **Execute change** only after the threshold is met. This publishes the signed update to the v3 state provider or v2 tracker.
5. For every intended deployed network, create a transaction with **Commit pending wallet updates** enabled, inspect the injected update calls/config decoration, collect transaction signatures, execute, and wait for a receipt.
6. Reload the wallet on each target network and verify the new checkpoint, image hash, threshold, signer list, and pending-update count.

If the checkpoint advances while signatures are being collected, stop and re-evaluate. Never force a stale update.

## Diagnose status

- **Pending**: proposed checkpoint is greater than the currently loaded checkpoint.
- **Stale**: proposed checkpoint is no longer ahead; inspect whether the same update became current or a competing update won.
- **Past update**: the wallet state advanced beyond the proposal.
- **Below threshold**: more current-signer weight is required; a future signer cannot authorize its own addition.

Use [troubleshooting.md](../enchanter-wallet-operator/references/troubleshooting.md) for service, config-loading, or commit failures.

## Completion evidence

Return the update subdigest, before/after checkpoint and image hash, signer/threshold diff, recovered signer weight, publication status, each target chain's commit transaction hash and receipt status, and the independently reloaded final configuration.
