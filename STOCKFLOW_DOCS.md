# StockFlow 🌊

StockFlow is a decentralized, programmable financial layer built on Solana. It enables users to unlock the liquidity of tokenized stocks (xAAPL, xTSLA, xNVDA) and automate their portfolios with intelligent, on-chain rules.

## The 4 Core Pillars

1. **StockFi:** Deposit tokenized real-world assets (RWAs) as collateral to unlock instant, stablecoin liquidity (USDC) without needing to sell your underlying stock positions.
2. **StockPay:** Instantly pay vendors or friends in USDC. If you don't have enough stablecoin balance, StockFlow automatically borrows against your stock collateral seamlessly in a single transaction.
3. **StockFlow (Automation):** Create programmable portfolio rules. Set "Flows" that automatically execute when specific conditions are met (e.g., "If xAAPL goes above $200, sell 10 shares and repay my USDC debt").
4. **Protection:** Fully automated risk management. Set maximum Loan-To-Value (LTV) limits, ensuring the protocol takes defensive action to prevent liquidations before the market turns against you.

---

## System Architecture

The StockFlow ecosystem consists of three primary layers:

### 1. Smart Contracts (Anchor / Rust)
Located in `/programs/stockflow/`, the on-chain logic handles vaults, collateralization math, risk verification (`risk.rs`), and flow validation. 
- All pricing logic is securely integrated with **Pyth Network** for real-time market data.
- Deployed on Solana Devnet.

### 2. The Frontend Client (Next.js)
Located in `/app/`, the client provides a premium, responsive interface for users to manage their vaults.
- **Tech Stack:** Next.js (App Router), Tailwind CSS (custom ink/paper/signal theme), Framer Motion (animations), and Lucide React (icons).
- **Web3 Integration:** Fully wired with `@solana/wallet-adapter` and a custom `@stockflow/sdk` to construct and submit Anchor instructions directly from the browser.
- **Live Data:** Fetches real Solana transaction signatures via Web3.js and animates live stock ticker prices via WebSockets connected to Pyth Hermes.

### 3. The Keeper Crank (Node.js)
Located in `/scripts/keeper.ts`, this standalone backend worker acts as the autonomous engine for StockFlow. 
- Solana contracts cannot trigger themselves. The Keeper constantly polls active user Flows and Pyth price feeds off-chain. 
- When a user's condition is met, the Keeper constructs an `execute_flow` transaction and submits it. 
- The smart contract mathematically re-verifies the condition on-chain before executing, ensuring a perfectly trustless system.

---

## Recent Changelog

### Smart Contracts & SDK
- Bypassed broken dependency chains to successfully deploy the StockFlow program to Devnet.
- Implemented comprehensive integration tests (`integration.rs`).
- Copied the Anchor IDL into the frontend SDK and wired up the `Program` constructor logic to support Anchor 1.0+ type requirements.

### UI & Frontend Enhancements
- **Landing Page:** Designed a premium, asymmetric landing page (`page.tsx`) with a glassmorphic TopNav and an infinite, animated Pyth network marquee ticker (`Marquee.tsx`).
- **Dashboard:** Transitioned the dashboard from a static UI to a dynamic Web3 interface. Replaced mocked generic icons with real corporate logos (Clearbit integration).
- **Live Activity Feed:** Stripped out mocked dashboard activity and replaced it with live RPC calls (`connection.getSignaturesForAddress`), rendering the user's real Devnet transaction history.
- **Interactive Modals:** Built custom, inline `TransactionModal` components to handle standard deposits and borrows securely via the wallet adapter.
- **Layout Synchronization:** Unified the layout wrappers, `TopNav`, and `Footer` across all secondary routes (`/flows`, `/flows/new`, `/borrow`, `/pay`) to eliminate disconnected "floating" pages and ensure a perfectly consistent dark-mode aesthetic.

### Automation Infrastructure
- Wrote the foundational `keeper.ts` Node script to enable the "StockFlow" automation pillar, capable of polling user state and Pyth price feeds.
