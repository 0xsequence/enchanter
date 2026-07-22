---
name: enchanter-rotate-signers
description: Rotate Sequence Enchanter signing keys or devices without locking the wallet. Use for planned key replacement, signer migration, hardware-wallet replacement, suspected or confirmed signer compromise, staged add-then-remove rotations, emergency atomic removal, and post-rotation witness and cross-chain verification.
---

# Rotate Enchanter Signers

Use `$enchanter-update-signers` for mechanics. This skill chooses the safe rotation strategy and adds key-verification and lockout controls.

## Decide the branch

### Planned rotation with healthy old signer

Prefer two checkpoints:

1. Add the new signer while retaining sufficient old signer weight.
2. Publish, commit, and verify that configuration on every active chain.
3. Derive the new address independently, connect the new key/device, publish a witness, and prove it can sign a harmless test message or transaction payload.
4. Remove the old signer in a second update.
5. Publish, commit, and verify again before retiring the old key.

This costs an extra update but proves the replacement key before access depends on it.

### Suspected or confirmed compromise

Do not preserve a compromised signer merely to follow the staged pattern. If trusted current signers can still meet the current threshold, propose one atomic update that removes the compromised address and adds the verified replacement, collect only trusted approvals, publish and commit promptly, and verify every active chain.

If the current threshold cannot be met without the compromised or unavailable signer, Enchanter cannot invent recovery authority. Stop and escalate to the wallet's separately configured recovery or governance process.

## Mandatory invariants

Read [security.md](../enchanter-wallet-operator/references/security.md) before proceeding.

- Verify the replacement address from the actual key/device twice; never copy it only from chat or a ticket.
- Ensure reachable current signer weight authorizes each update.
- Ensure reachable post-rotation signer weight meets the new threshold with the old signer removed.
- Keep the wallet address constant; only checkpoint, image hash, signer topology, weights, or threshold should change.
- Account for every chain on which the wallet is deployed or funded. Off-chain publication is not sufficient evidence of per-chain activation.
- Inventory every pre-existing pending update. Reconcile its intent and ordering before proposing the rotation; stop rather than guessing that a competing update can be cancelled.
- Do not destroy, wipe, or archive the old key until the planned rotation is committed and independently verified. For a compromised key, quarantine it according to incident policy instead of using it for convenience.
- Refresh witnesses after adding the new signer. A removed signer's historical witness may still appear in discovery, so validate membership against current state.

## Rotation record

Record the reason and branch, old and new public addresses, all before/after checkpoints and image hashes, signer/threshold diffs, approving signer addresses and weight, target chains, commit transaction hashes, new-signer proof, witness status, and final current configuration. Never record private material.
