# Enchanter security and autonomy policy

## Contents

- [Authority boundaries](#authority-boundaries)
- [Key handling](#key-handling)
- [Configuration invariants](#configuration-invariants)
- [Signing checks](#signing-checks)
- [Update and rotation safety](#update-and-rotation-safety)
- [Execution safety](#execution-safety)
- [Incident stops](#incident-stops)

## Authority boundaries

Classify every action before performing it:

| Class | Examples | Required certainty |
| --- | --- | --- |
| Read-only | Inspect public state, local IndexedDB, witnesses, receipts | Correct address and source |
| Public off-chain write | Create config, publish payload/signature/witness/update | Explicit task scope and verified signer intent |
| Test service write | Create throwaway v2/v3 config or witness | Test-only keys, no funds, clear artifact handling |
| On-chain write | Deploy, execute, transfer, commit update | Exact chain, calls, value, funding key, and final preview |
| Destructive key action | Delete/wipe/retire signer material | Explicit authority plus verified completed rotation |

Permission to inspect does not authorize a signature. Permission to create a counterfactual wallet does not authorize deployment or funding. Permission to publish an update does not authorize committing it on every chain. Permission to test does not authorize use of a funded or production signer.

## Key handling

- Keep private keys and mnemonics outside Enchanter and outside Git. Enchanter expects an injected signer and stores no private key.
- Prefer hardware wallets or approved key-management systems for durable signers.
- Derive each public signer address directly from its key/device before use. Compare the full checksummed address, not only a prefix or suffix.
- Never paste private keys into skill files, source, tickets, exported Enchanter JSON, logs, screenshots, or prompts.
- Treat `E2E_PRIVATE_KEY` as funded test-only material. The fixture uses it on Polygon Amoy and can spend testnet POL. Unset it for non-funded tests.
- Store generated test fixtures only under ignored `test-results/`, mode 0600. Do not print or inspect their private fields in agent output.
- Never use an existing work or personal secret to “make a test easier.” Generate ephemeral keys.

## Configuration invariants

Before creating or updating:

1. Checksum every signer address and reject duplicates case-insensitively.
2. Reject nested Sequence wallets because this Enchanter implementation cannot operate them as signers.
3. Use integer threshold `1..65535`.
4. Use integer signer weights `1..255` operationally. Although the protocol/UI type permits zero, zero-weight entries add ambiguity and no authority.
5. Require total weight at least the threshold.
6. Enumerate intended valid signer combinations. At least one available operational combination and one documented recovery combination should reach threshold for a durable wallet.
7. For updates, prove reachable **current** signer weight can authorize the update; future signers cannot sign themselves into the wallet.
8. Prove the **new** configuration remains usable after every signer being removed is unavailable.
9. Require next checkpoint to equal current checkpoint + 1. If current state changes during review, rebuild the proposal.

## Signing checks

Before approving a wallet request:

- confirm the wallet address and protocol version;
- confirm the operation type: witness, message, transaction, or config update;
- confirm chain ID (`0` means all-networks payload, not “no chain”);
- for a transaction, decode every call, destination, value, calldata, delegate-call flag, failure behavior, space, and nonce;
- for an update, compare the complete old/new signer and threshold diff and the target image hash;
- verify the connected address is the intended current signer;
- reject blind/opaque signing when the request cannot be tied to the reviewed subdigest;
- collect only as much signer participation as policy requires, but allow extra valid weight when normal multisig practice calls for it.

For v3 expect EIP-712 typed signing; for v2 expect raw-subdigest message signing. A surprising method or chain is a stop condition.

## Update and rotation safety

### Planned replacement

Use add/verify/remove across two checkpoints when practical:

1. add replacement while retaining current access;
2. publish and commit on active chains;
3. verify replacement can sign and publish a witness;
4. remove old signer;
5. publish, commit, and independently verify again;
6. retire old material only after completion evidence exists.

### Active compromise

Do not retain a compromised signer for staged convenience. If trusted current signers still meet threshold, atomically remove the compromised address, add a replacement verified in advance, publish, commit, and verify promptly. If the current threshold is unreachable without the compromised/unavailable signer, stop: Enchanter has no authority to bypass the configuration.

Track all chains where the wallet is deployed, funded, or operationally accepted. Verify each chain after a rotation; do not infer per-chain activation solely from service publication.

Historical witnesses can continue to surface a removed signer. Current configuration, not discovery history, decides authorization.

## Execution safety

- Confirm the injected broadcaster is on the intended chain. Enchanter can switch for v3 signing, but execution still needs the correct active network.
- Simulate or decode calls when feasible. Never approve unknown delegate calls.
- Use exact integer wei values; do not infer token decimals.
- Review **Commit pending wallet updates** because it can prepend/decorate additional state-changing calls beyond the user-entered actions.
- Confirm the broadcaster has only the gas funds required. Funding the smart wallet is separate.
- Wait for a mined receipt and wallet execution event. Distinguish outer revert from wallet action failure.
- Do not retry blindly after an uncertain result. Refresh receipt/nonce status to avoid duplicate or replaced operations.

## Incident stops

Stop and escalate when:

- an unrecognized signer, destination, image hash, call, or network appears;
- expected signer weight is unavailable;
- the wallet checkpoint or nonce changes during collection;
- a witness exists for a signer absent from current configuration and the task assumes it is authorized;
- service state and on-chain state disagree in a way that changes the safe signer set;
- the same wallet appears as both a proposed signer and the wallet being configured;
- a secret appears in logs, source, an export, or browser storage unexpectedly;
- the task needs recovery authority not present in the current configuration.
