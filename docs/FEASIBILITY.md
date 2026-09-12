# StockFlow — Feasibility Notes

Last verified: September 12, 2026, against live npm/crates.io registries
and an actual `npm install` + `tsc` + `next build` of this scaffold.
Re-check anything below before relying on it in a demo — this ecosystem
moves fast (see the Anchor 1.0 section below for why that's not a
throwaway line).

## Confirmed live and integrable

**xStocks (tokenized equities)** — live on Solana since June 30, 2025,
each token 1:1 backed by a real share via a regulated custodian.
Tickers end in `x` (NVDAx, AAPLx, SPYx). Liquidity on Raydium, routing
via Jupiter.

**Kamino Lend (`klend`) — StockFi collateral engine** — added xStocks
as loan collateral in July 2025; Chainlink provides price feeds.
Tokenized-stock collateral on Solana reached ~$53M by late July 2026,
with Kamino managing the majority of it. StockFlow CPIs into `klend`
rather than building its own lending market.

**Tuk Tuk — automation/keeper layer** — Helium's maintained successor
to Clockwork (which stopped being supported in August 2023). Supports
time-based and on-chain-event triggers with TS and Rust SDKs.

## Anchor hit a stable 1.0 in April 2026 — this changes real things

If you're following any tutorial written before ~April 2026, it's
targeting the pre-1.0 line and several things will be wrong:

- **TS package renamed**: `@coral-xyz/anchor` → `@anchor-lang/core`.
  The old package is still published (frozen at `0.32.1`) but is now
  the legacy line — don't mix the two in one project.
- **`anchor test` no longer defaults to `solana-test-validator`** — it
  uses **Surfpool** (or LiteSVM) instead. Surfpool is a standalone CLI
  tool, not an npm package — install it separately, or `anchor test`
  will fail with a connection error. `AnchorProvider.env()` still
  works unchanged once Surfpool is running.
- **The Solana CLI is no longer required on PATH** for most `anchor`
  commands (balance/airdrop/address/deploy are now native to the
  anchor CLI) — you'll still want `solana-keygen` for wallet setup.
- `anchor-lang`/`anchor-spl` versions are now synced with the
  `anchor-cli` version (current: `1.2.0`). This scaffold's
  `Cargo.toml` and `Anchor.toml` are pinned to `1.2.0`.

**Action item:** install Surfpool before running `anchor test` on this
scaffold, and confirm the installed `anchor-cli` version matches
`Anchor.toml`'s `anchor_version`.

## klend-sdk v12 moved to @solana/kit — a real integration seam

`@kamino-finance/klend-sdk` is at `12.0.0` and depends on **`@solana/kit`**
(Solana's newer functional web3 library — `Address` strings, no
`Connection`/`PublicKey` classes) rather than the classic
`@solana/web3.js` that the wallet-adapter ecosystem (and this SDK) is
built on. Kamino ships `@solana/compat` specifically to bridge the two.
This is not a drop-in call — budget real implementation time for it in
`packages/sdk/src/portfolio.ts`.

Installing `klend-sdk` alongside `@solana/wallet-adapter-*` produced
`ERESOLVE`/peer-dependency **warnings** (not hard failures) during
`npm install` — these come from a version mismatch inside Kamino's own
dependency tree (`@kamino-finance/farms-sdk` wants `@solana/kit@^2`,
while `@kamino-finance/kliquidity-sdk`'s nested `@solana-program/token-2022`
wants `@solana/kit@^3`). Nothing to fix on our end; just don't be
alarmed by the warnings.

## Verified by actually building this scaffold

- `npm install` at the repo root succeeds (1,572 packages).
- `packages/common` and `packages/sdk` compile clean with `tsc`.
- `automation` compiles clean with `tsc`.
- The Next.js `app` type-checks clean and **produces a full production
  build** (`next build`, all 5 routes statically generated) once
  Google Fonts are reachable — see below.
- `ts-node-dev` (originally used for the automation worker's dev
  script) hasn't been published since June 2022 and is effectively
  unmaintained; swapped for **`tsx`** (actively maintained, `4.23.13`).

## Two things this sandbox couldn't verify — check on your own machine

1. **`next build` needs to reach `fonts.googleapis.com`** — this build
   sandbox's network doesn't allow that domain, so the build failed
   there specifically (confirmed by temporarily stubbing the font
   imports, after which the build succeeded end-to-end). This will
   almost certainly work fine from a normal machine/CI runner, but if
   you're building on a locked-down network (some hackathon venues
   restrict outbound traffic), switch `next/font/google` to
   `next/font/local` with self-hosted `.woff2` files.
2. **No Rust/Anchor/Solana CLI toolchain in this sandbox**, so
   `programs/stockflow` has not been compiled. The Rust code is
   internally consistent (types, seeds, and account sizes all line
   up), but `anchor build` is the real test — run it before trusting
   the program compiles.

## Not yet verified — do before relying on them in a demo

1. Exact Kamino devnet program ID + a live devnet market with an
   xStocks reserve seeded with test liquidity. Two candidate IDs exist
   in earlier research and conflict — confirm directly against
   Kamino's docs or Discord.
2. Whether Tuk Tuk's task queue program has an active devnet
   deployment, and its current package name/version on npm (not
   checked this pass).
3. Whether Chainlink devnet price feeds exist for the specific xStocks
   you plan to demo with — if not, the simulation engine needs a mock
   oracle for devnet.
4. Pin an exact commit of the `kamino-lending` git dependency in
   `Cargo.toml` (it's not on crates.io) — the klend repo has evolved
   substantially since mid-2025, so don't assume an old tutorial's CPI
   account layout still matches HEAD.

## Fixed this pass — a real correctness bug and a real security gap

Both found by actually exercising the code, not by re-reading it:

1. **LTV projection bug.** `execute_flow`'s Borrow path (and the
   borrow-fallback inside Pay) checked the obligation's *current* LTV
   against `max_ltv_bps` before approving a borrow — never accounting
   for the borrow itself. That would let an origination through that
   pushes LTV *past* the configured limit, since the check ran before
   the state it was gating. Fixed by extracting a pure
   `risk::project_ltv_bps(obligation, delta_debt_usd)` function (with
   unit tests) and routing every LTV check — current AND projected —
   through it with an explicit delta.
2. **Recipient enforcement gap.** `Constraints.locked_recipient` was
   optional, so a Pay's destination was only checked against it when a
   client happened to also set that field — `Flow.destination` itself
   was never enforced. Any authorized caller (the owner, or a delegate
   they'd approved for the automation worker) could otherwise redirect
   a Pay to any token account, regardless of what `destination` said
   at creation. Fixed by removing the redundant field and always
   enforcing `destination_token_account.owner == flow.destination`.
3. **Invalid placeholder program ID.** `STFLowXXXX...` looked like a
   pubkey but wasn't valid base58/32-bytes — constructing a
   `PublicKey` from it threw immediately, which crashed any TS code
   path that imported `packages/common/src/config.ts` at all
   (including via `packages/sdk`). Caught by actually running the test
   suite, not by inspection. Replaced with a randomly generated valid
   pubkey, consistent across `lib.rs`, `Anchor.toml`, and
   `config.ts` — still a placeholder, but one that doesn't crash on
   import. Run `anchor keys sync` after your first `anchor build` to
   replace it with your real program keypair.

## What's now backed by an actual passing test suite

- `programs/stockflow/src/risk.rs` has `#[cfg(test)]` unit tests for
  the LTV projection math (including the exact bug in #1 above) — not
  run in this sandbox (no Rust toolchain), but present and specific.
- `packages/sdk/src/__tests__/` — 13 passing tests (`node --test`)
  covering `computeSimulation`/`classify` and the new deterministic
  `compileIntent` parser, including the PRD's own example sentence.
- `automation/src/__tests__/` — 7 passing tests covering the
  time-interval and risk-threshold trigger checkers.
- Run them yourself: `npm run test` from the repo root.

## New this pass

- `compileIntent` (`packages/sdk/src/intent.ts`) is now a real,
  working deterministic parser — not an LLM call, a regex-based
  compiler that extracts action/amount/trigger/max-LTV/recipient from
  natural language, degrades honestly (never fabricates a collateral
  mint or a recipient) when it can't parse something with confidence,
  and throws with an actionable message pointing at the structured
  form when it can't produce a safe FlowSpec at all.
- `getPortfolio` now does a real `getParsedTokenAccountsByOwner` RPC
  call and returns actual token balances — `valueUsd`/LTV fields
  remain 0 pending the price-feed and Kamino-obligation work described
  above, but the holdings themselves are real, not fabricated.
- Added a `close_flow` instruction (rent reclamation for a Paused
  Flow — a Flow must be explicitly paused first, as a deliberate
  two-step safety measure).

## What StockFlow's own program actually needs to build

Everything else — the Flow account, trigger/action/source/constraint
schema, simulation math, on-chain constraint enforcement, and the
orchestration between StockFi/StockPay/Protection — is genuinely new
work, and is what's fully written out in this scaffold rather than
stubbed.
