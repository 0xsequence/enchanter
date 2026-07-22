---
name: enchanter-witnesses
description: Publish, inspect, and troubleshoot Sequence Enchanter witness records and signer-based wallet discovery for v2 and v3. Use when making a wallet auto-detectable, finding wallets for a connected signer, distinguishing witnesses from authorization or signature mailboxes, or diagnosing missing, duplicate, historical, or partial discovery results.
---

# Enchanter Witnesses

A witness is a public proof-of-intent record linking a signer to a wallet in Sequence services. It enables reverse lookup; it does not transfer ownership, change configuration, prove current membership forever, or authorize an on-chain action.

## Publish safely

1. Read the witness sections of [architecture.md](../enchanter-wallet-operator/references/architecture.md) and [security.md](../enchanter-wallet-operator/references/security.md).
2. Load the wallet's current state and confirm the connected address is a current signer.
3. Select **Sign witness** on the wallet view and inspect the signature request:
   - v2 signs a chain-0 subdigest and stores the typed `02` witness through the sessions tracker;
   - v3 signs EIP-712 typed message data containing action, wallet, signer, and timestamp, then stores it through the Key Machine.
4. Wait for **Witness published**, reload, and confirm the button reports the published state.
5. Forget or use a separate browser profile only when testing rediscovery. Connect the same signer and verify the wallet appears under **Detected wallets** before adding it locally.

Signing an Enchanter transaction can also create a witness as a side effect. Publish an explicit witness when the signer has not signed an operation yet or when deterministic discovery is the goal.

## Interpret discovery

- Enchanter unions v3 Key Machine and v2 tracker results, checksums addresses, and deduplicates them.
- The v3 lookup reads at most 500 results (five pages of 100).
- Failure of one service can yield partial results from the other.
- A historical witness can remain discoverable after signer removal. Always reload the wallet and check the current signer configuration.
- The local **Add** action creates only a browser-local label; it does not import keys or grant authority.

## Do not confuse with the mailbox

The signature mailbox is keyed by an operation subdigest and transports transaction, message, or update signatures between devices. A wallet witness is keyed by a real signer and supports signer-to-wallet discovery. Mailbox entries are untrusted transport envelopes whose inner signatures are recovered and checked against the current configuration.

Use `$enchanter-find-wallets` to enumerate and validate results. Use [troubleshooting.md](../enchanter-wallet-operator/references/troubleshooting.md) when a published witness does not appear.

## Completion evidence

Return the wallet address, version, signer address, publication result, discovery source, and current signer-membership validation. Do not claim the witness proves present control.
