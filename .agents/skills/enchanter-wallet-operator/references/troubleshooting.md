# Enchanter troubleshooting

## Wallet not found as v2 or v3

- Validate the checksummed 20-byte address.
- Distinguish an EOA from a Sequence wallet address.
- Retry both public state services; an unpinned import tries v3 then v2.
- If the wallet was only created locally in a failed test, confirm config publication completed.
- For a known version, pin it rather than accepting the fallback's combined error.

## Duplicate wallet

The browser DB has a unique address index. Open the existing local row or remove it intentionally before re-adding. A different name does not create a distinct wallet.

## Nested wallet rejected

Enchanter checks both v2 tracker counterfactual state and v3 deploy state for each signer. Use an EOA or another supported non-Sequence signer; nested Sequence wallets are not implemented.

## Threshold or signer validation fails

- Check threshold `1..65535` and each weight `1..255` operationally.
- Check total weight reaches threshold.
- Check duplicate addresses after checksum normalization.
- Recompute intended signer combinations, not just total weight.

## Connected account cannot sign

- Compare the full connected address with the current signer list.
- Check whether it already signed the subdigest.
- Reload state: a signer may have been removed by a newer checkpoint.
- For v3 chain-specific typed signing, switch to the payload chain.
- Do not use the broadcaster role as evidence of signer authority.

## Update remains below threshold

Only current configuration signers count. A signer being added in the target configuration cannot approve that update. Collect additional current-signer weight or stop if current threshold is unreachable.

## Update is stale

Reload current checkpoint and image hash. If the proposal image hash is current, the update succeeded and is now historical. If a different image hash owns the same or later checkpoint, rebuild the intended change from current state; do not replay the stale proposal.

## “New wallet configuration not found”

The target config did not load from the v2 tracker or v3 state provider. Do not publish a v3 config-update payload without `toConfig`. Retry config retrieval and confirm the image hash maps to the exact reviewed signer topology before signing or executing.

## Published update is not active on-chain

`Execute change` publishes the approved update off-chain. Build a transaction on the target chain with **Commit pending wallet updates** enabled, sign, execute, wait for the receipt, and reload chain-aware status.

## Witness published but wallet is missing

- Reload after service propagation.
- Query both v3 Key Machine and v2 tracker with `find-wallets.mjs`.
- Confirm the lookup uses the exact signer address that produced the witness.
- Remember v3 detection stops after 500 results.
- Treat one service's failure as a potentially partial result.
- Verify the witness signature request completed rather than only being opened.

## Wallet is discovered for a removed signer

Witnesses are historical public records. Open the wallet and validate the current signer list. Do not treat the discovery result as authorization.

## Missing v3 operation by subdigest

- Verify the route contains a 32-byte `0x` subdigest.
- Retry Key Machine lookup.
- The payload may never have been published, or it may use call features Enchanter cannot represent losslessly.
- Use an exported Enchanter JSON payload when available.
- v2 payload restoration requires export/import.

## Co-signer signature does not sync

- Keep the detail view open while threshold is unmet; mailbox polling is every 10 seconds.
- Verify the same subdigest and version on both devices.
- Export/import as a deterministic fallback.
- Invalid or non-member signatures can be transported but will not add weight.
- The mailbox scans at most 500 entries.

## Execution disabled

- Confirm recovered signer weight meets threshold.
- Connect a broadcaster.
- Switch to the transaction chain unless chain ID is 0.
- Refresh receipt/nonce status; it may already be executed, failed, replaced, or consumed.

## Submitted transaction has uncertain result

Do not resubmit immediately. Query the transaction receipt, wallet execution events, and wallet nonce. An outer revert leaves the wallet nonce available for retry; a consumed nonce can mean another payload replaced it. Report the unresolved state and transaction hash until chain evidence is available.
