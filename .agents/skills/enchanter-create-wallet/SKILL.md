---
name: enchanter-create-wallet
description: Create and verify new Sequence v2 or v3 smart-contract wallets in Enchanter. Use when choosing a protocol version, threshold, weighted signer set, salt/checkpoint, local name, test-wallet fixture, or when diagnosing counterfactual wallet creation and duplicate-address behavior.
---

# Create an Enchanter Wallet

Create a counterfactual wallet configuration first; deployment and funding are separate on-chain actions.

## Prepare

1. Read [architecture.md](../enchanter-wallet-operator/references/architecture.md) and [security.md](../enchanter-wallet-operator/references/security.md).
2. Choose v3 for a new wallet unless interoperability requirements explicitly require v2. Never reinterpret or migrate an existing wallet by changing this selector.
3. Derive and verify every signer address from its intended key or hardware device without exposing private material.
4. Define integer weights and a threshold. Require `1 <= threshold <= 65535`, `1 <= weight <= 255`, unique signer addresses, and `sum(weights) >= threshold`.
5. Prove that the intended day-to-day and recovery signer combinations reach the threshold. Enchanter currently rejects nested Sequence wallets as signers.
6. Choose a unique salt/checkpoint in `0..2147483647`. Reusing the same version/context, signer topology, threshold, and checkpoint reproduces the same wallet address.

## Create through Enchanter

Follow the Create procedure in [workflows.md](../enchanter-wallet-operator/references/workflows.md). Record the local name, version, threshold, signer list, salt, resulting checksummed address, checkpoint, and image hash.

Do not deploy or fund the wallet merely because creation succeeded. An undeployed wallet is usable in its counterfactual state and has the same address on compatible EVM networks.

## Verify

- Reload the wallet by address and pin the observed v2/v3 version.
- Confirm threshold, signer addresses and weights, checkpoint, and image hash.
- Confirm the wallet appears in the browser-local list with the requested local-only name.
- Confirm none of the signers resolves as a Sequence wallet.
- For a wallet meant to be rediscovered by signer, publish and verify a witness with `$enchanter-witnesses`.
- Preserve a public configuration record; preserve signing keys only in the approved external key store.

## Create test fixtures

Read [testing.md](../enchanter-wallet-operator/references/testing.md). Use the shared `create-test-wallets.mjs` helper or the non-funded Playwright cases with `E2E_PRIVATE_KEY` explicitly unset. Test fixture creation writes public configurations to Sequence services but performs no funded chain transaction.

## Completion evidence

Return the address, protocol version, checkpoint/salt, image hash, threshold, public signer weights, deployment state, and whether a witness was published. Never return signer secrets.
