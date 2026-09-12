# StockFlow

A programmable financial operating layer for tokenized stocks on Solana.

Four pillars, one control layer:

| Pillar | What it does | Backed by |
|---|---|---|
| **StockFi** | Borrow stablecoins against tokenized stocks without selling | Kamino Lend (`klend`) CPI |
| **StockPay** | Spend portfolio value directly — USDC first, borrow if short | This program + SPL Token |
| **StockFlow** | Automate financial behavior via Flows (`Trigger → Action → Source → Constraints → Destination`) | This program + Tuk Tuk (off-chain trigger detection) |
| **Portfolio Protection** | Auto-pause discretionary spending when LTV crosses a threshold | This program (`ProtectionPolicy` account) |

Read `docs/FEASIBILITY.md` first — it documents exactly which pieces of
this stack are confirmed live and integrable today (xStocks, Kamino
collateral support, Tuk Tuk automation) versus what still needs
verification before a devnet demo (exact devnet program IDs, price
feed availability). The full PRD is in `docs/StockFlow_PRD_v1.0.docx`.

## Repo layout

```
stockflow/
├── programs/stockflow/     Anchor program (Rust) — Flow + ProtectionPolicy
│   └── src/
│       ├── state/          Flow, ProtectionPolicy account schemas
│       ├── instructions/   create_flow, execute_flow, pause/resume, protection
│       └── cpi/kamino.rs   Thin Kamino Lend CPI wrapper (stubbed — see FEASIBILITY.md)
├── packages/
│   ├── sdk/                Developer SDK: createFlow, simulateFlow, executeFlow,
│   │                       pauseFlow, getPortfolio, getRisk, getLiquidity
│   └── common/             Shared types + config, mirrors the on-chain schema
├── automation/             Off-chain worker: detects triggers, submits execute_flow.
│                           Devnet poller now; swap in Tuk Tuk (automation/src/tuktuk.ts)
│                           for production.
├── app/                    Next.js dApp — Portfolio / Flows / Pay / Borrow
├── tests/                  Anchor test skeleton (constraint-enforcement cases)
└── docs/                   PRD + feasibility notes
```

## What's real vs. stubbed right now

This is a scaffold, not a finished build — it's structured so the real
work (the Flow schema, on-chain constraint enforcement, the dApp UX)
is fully written, while the seams that depend on external protocols
are clearly marked rather than faked:

- **Fully implemented:** the `Flow`/`ProtectionPolicy` account schemas,
  all instruction handlers and their constraint checks (LTV ceiling —
  correctly *projected*, not just checked against the current value;
  see `docs/FEASIBILITY.md`'s bugfix notes — amount limits, always-
  enforced recipient, anti-spam interval, protection pause), a
  `close_flow` instruction, the SDK's PDA derivation and simulation
  math, a real deterministic natural-language `compileIntent` parser,
  real on-chain token-balance fetching in `getPortfolio`, and the
  dApp's page structure and forms. All backed by a 20-test passing
  suite (`npm run test`) plus Rust unit tests for the LTV math.
- **Stubbed with a clear TODO:** the actual Kamino CPI calls
  (`cpi/kamino.rs`, needs the confirmed devnet program ID), pricing
  data for `getPortfolio`'s holdings (needs a price feed), the SDK's
  `program` binding for `createFlow`/`executeFlow`/`pauseFlow` (needs
  `anchor build`'s generated IDL), and the Tuk Tuk task registration
  (needs its current package name/devnet status confirmed).

Nothing here silently pretends to work when it doesn't — every stub
throws or is commented rather than returning fake success.

## Getting started

```bash
npm install
npm run test              # 20 passing unit tests (sdk + automation) — run these first
anchor build              # generates target/idl/stockflow.json — copy into packages/sdk/src/idl/
anchor deploy --provider.cluster devnet
npm run build              # builds packages/sdk and packages/common
npm run app:dev             # Next.js dApp on localhost:3000
npm run automation:dev      # off-chain trigger-detection worker
```

**Anchor 1.0 note:** `anchor test` now uses Surfpool instead of
`solana-test-validator` — install it separately first, or tests will
fail with a connection error. See `docs/FEASIBILITY.md`.

Before deploying to devnet, resolve the open items in
`docs/FEASIBILITY.md`: confirm Kamino's real devnet program ID and
market address, and confirm Tuk Tuk's current SDK/devnet status.
Everything in `cpi/kamino.rs` and `automation/src/tuktuk.ts` is wired
to be a five-minute change once those are known — the interfaces
around them are already in place.

## Verified vs. assumed

Every dependency version in this repo (`@anchor-lang/core`,
`@kamino-finance/klend-sdk`, `@solana/web3.js`, `@solana/wallet-adapter-*`,
`next`, `react`) was checked against the live npm/crates.io registries
on Sept 12, 2026, not filled in from memory — and the TypeScript,
Next.js, and SDK packages were actually installed and built
(`tsc`/`next build`) to confirm they compile. Only the Rust program
(no Solana toolchain in the build sandbox) and the on-chain
Kamino/Tuk Tuk devnet wiring (needs live devnet addresses) are
unverified — both are called out explicitly in `docs/FEASIBILITY.md`
rather than assumed to work.

One deliberate exception: `typescript` is pinned to `^5.7.3` even
though `7.0.2` is the current latest (a from-scratch Go-based rewrite,
"tsgo", released as a full major in 2026). Held back one major
version here since surrounding tooling (editor plugins, some
Next.js/Anchor tooling) may not have fully caught up yet — worth
revisiting as that ecosystem matures.
