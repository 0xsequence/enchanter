---
name: enchanter-find-wallets
description: Find, rediscover, validate, and import Sequence Enchanter wallets by local browser record, wallet address, signer address, witness reverse lookup, or v3 operation subdigest. Use for lost local wallet lists, cross-device discovery, duplicate imports, unknown protocol versions, or identifying wallets associated with a signer.
---

# Find Enchanter Wallets

Treat discovery evidence as a lead, not proof of current authorization or ownership.

## Search in this order

1. Check **My wallets**. These records live in the browser's `sequence-enchanter` IndexedDB and contain a local name, address, and sometimes a pinned protocol version.
2. If the wallet address is known, open or import it directly. Enchanter attempts v3 and then v2 when no version is pinned. Validate the loaded configuration before adding the local label.
3. If only a signer address is known, connect that signer and inspect **Detected wallets**, or run from the repository root:

   ```sh
   node .agents/skills/enchanter-wallet-operator/scripts/find-wallets.mjs 0xSIGNER
   ```

   The lookup unions v3 Key Machine and v2 tracker witness results, normalizes checksums, and deduplicates addresses.
4. If a v3 transaction, message, or update subdigest is known, open its detail route. Enchanter can restore a representable v3 payload from the Key Machine and then sync valid co-signer signatures from its mailbox.
5. If only a local export exists, import the portable JSON, then add or import the wallet address separately if it is not already in the local wallet list.

Read the Find and import procedure in [workflows.md](../enchanter-wallet-operator/references/workflows.md) and the witness model in [architecture.md](../enchanter-wallet-operator/references/architecture.md).

## Validate every candidate

- Resolve a checksummed address and a concrete v2 or v3 configuration.
- Record threshold, signers, weights, checkpoint, image hash, deployment state, and pending updates.
- Check whether the target signer is in the **current** configuration. A historical witness can outlive signer removal.
- Distinguish `not found` from a transient Key Machine, tracker, or RPC failure.
- Do not merge similarly named wallets; names are local and non-authoritative.
- Do not infer control from a witness, a transaction broadcaster, or possession of an exported payload.

## Known limits

Enchanter's v3 witness detection reads at most five pages of 100 results. v2 and v3 service failures are isolated, so a partial result can contain wallets from only one source. Operation-by-subdigest restoration is v3-only and rejects payload forms Enchanter cannot round-trip losslessly.

## Completion evidence

Return each validated wallet's address, version, discovery source, current signer membership for the queried signer, checkpoint, and whether it was added locally. Never return secret keys or claim ownership from discovery alone.
