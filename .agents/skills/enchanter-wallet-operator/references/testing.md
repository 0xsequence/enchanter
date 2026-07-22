# Safe Enchanter wallet testing

## Test levels

| Level | Writes | Funds | Recommended use |
| --- | --- | --- | --- |
| UI validation | Browser-local state | None | Form and route behavior |
| Service fixture | Public v2 tracker/v3 Key Machine config and witnesses | None | Real counterfactual create/find/sign flows |
| Non-funded Playwright | Browser-local plus public Sequence services | None | Full portable workflows except chain execution |
| Funded Amoy | Above plus Polygon Amoy transactions | Testnet POL | Deployment, transfer, receipt, config commit |

Public service fixture writes are durable even when no chain transaction occurs. Use clearly test-only, unfunded signers and unique salts.

## Create throwaway v2 and v3 wallets

From the repository root:

```sh
node .agents/skills/enchanter-wallet-operator/scripts/create-test-wallets.mjs \
  --output test-results/enchanter-skill-wallets.json \
  --publish-witnesses
```

The helper:

- generates two ephemeral EOA signers;
- creates one Sequence v2 and one v3 counterfactual wallet with a 2-of-2 policy by default;
- verifies each public configuration can be read back;
- optionally publishes a test witness for the first signer and confirms reverse discovery;
- writes signer private keys only to the requested ignored artifact with mode 0600;
- prints only public signer and wallet addresses;
- never deploys, funds, or submits an EVM transaction.

The output must remain under `test-results/`, which this repository ignores. Delete the artifact when the test signers are no longer needed. Do not `cat` it or include it in agent output.

Playwright clears its `test-results/` output directory when a suite starts. Run the helper after Playwright if the secret test artifact must remain available for a later test, or expect the suite to destroy it.

Options:

```text
--output PATH              Required; must be below test-results/
--wallets-per-version N    Default 1
--threshold N              Default 2
--signers N                Default 2; each has weight 1
--salt-base N              Default random safe uint31
--publish-witnesses        Publish first-signer witness for every wallet
--force                    Replace an existing output artifact
```

## Run the non-funded suite

Explicitly remove any funded key from the test process:

```sh
env -u E2E_PRIVATE_KEY pnpm test:e2e
```

This suite uses generated ephemeral EOA keys and writes real v2/v3 service records. It does not run tests tagged `@funded`.

Useful targeted cases:

```sh
env -u E2E_PRIVATE_KEY pnpm exec playwright test tests/e2e/protocol-flows.spec.ts --workers=1
env -u E2E_PRIVATE_KEY pnpm exec playwright test tests/e2e/keymachine-sync.spec.ts --workers=1
env -u E2E_PRIVATE_KEY pnpm exec playwright test tests/e2e/authorization-states.spec.ts --workers=1
```

## Funded Amoy testing

Run only with explicit authority and a dedicated Polygon Amoy-only key that contains no real funds:

```sh
E2E_PRIVATE_KEY=0xTEST_ONLY_KEY pnpm test:e2e:funded
```

Funded tests deploy fresh v2/v3 wallets, send native value, execute wallet calls, and commit signer updates. They intentionally consume testnet POL. Never substitute a production, personal, or work wallet key.

## Validate skill and repository changes

Run:

```sh
pnpm build
pnpm lint
pnpm spellcheck
```

Validate every canonical skill with the skill-creator `quick_validate.py`, then verify both `.codex/skills` and `.claude/skills` resolve to the same canonical `.agents/skills` directories.
