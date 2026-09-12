import { PublicKey } from "@solana/web3.js";
import { Action, Constraints, FlowSpec, Source, Trigger, resolveXStockMint } from "@stockflow/common";

/**
 * The "Policy Compiler" from the PRD's flow diagram: turns a natural-
 * language instruction into a structured FlowSpec.
 *
 * This is a deterministic, regex-based implementation — not an LLM
 * call. Per the PRD, "AI is optional... this is where AI is useful,
 * rather than being a gimmick" — meaning a hosted-LLM version is a
 * strict upgrade over this, not a replacement it depends on. This
 * function is what actually ships without needing an API key, and the
 * dApp's structured-controls form (app/src/app/flows/new) is the
 * fallback when even this can't parse something with confidence.
 *
 * Example input this correctly parses:
 * "Pay my developer $500 every month. Use USDC first, then borrow
 * against NVDA if needed. Never go above 40% LTV. Send to
 * 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU."
 */
export interface CompileIntentInput {
  text: string;
  owner: PublicKey;
  nextFlowId: bigint;
}

export interface CompileIntentResult {
  spec: FlowSpec;
  /** Human-readable summary shown back to the user for confirmation
   * before Simulate, per the PRD's "YOUR FLOW" review screen. */
  summary: string[];
  confidence: number;
}

const USDC_DECIMALS = 6;
const DEFAULT_MAX_LTV_BPS = 4000; // 40% — matches the PRD's own example throughout
const BASE58_PUBKEY_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

function parseActionKind(text: string): { kind: "Pay" | "Borrow" | "Repay"; index: number } {
  const candidates: Array<{ kind: "Pay" | "Borrow" | "Repay"; re: RegExp }> = [
    { kind: "Repay", re: /\brepay\b/i },
    { kind: "Pay", re: /\bpay\b/i },
    { kind: "Borrow", re: /\bborrow\b/i },
  ];
  let best: { kind: "Pay" | "Borrow" | "Repay"; index: number } | null = null;
  for (const c of candidates) {
    const m = text.match(c.re);
    if (m && m.index !== undefined && (best === null || m.index < best.index)) {
      best = { kind: c.kind, index: m.index };
    }
  }
  return best ?? { kind: "Pay", index: -1 };
}

function parseAmountUnits(text: string): bigint | null {
  const m = text.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const dollars = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(dollars)) return null;
  return BigInt(Math.round(dollars * 10 ** USDC_DECIMALS));
}

function parseTrigger(text: string): { trigger: Trigger; wasExplicit: boolean } {
  if (/every\s+month|monthly/i.test(text)) {
    return { trigger: { kind: "TimeInterval", intervalSeconds: 30 * 24 * 3600 }, wasExplicit: true };
  }
  if (/every\s+week|weekly/i.test(text)) {
    return { trigger: { kind: "TimeInterval", intervalSeconds: 7 * 24 * 3600 }, wasExplicit: true };
  }
  if (/every\s+day|daily/i.test(text)) {
    return { trigger: { kind: "TimeInterval", intervalSeconds: 24 * 3600 }, wasExplicit: true };
  }
  return { trigger: { kind: "OnDemand" }, wasExplicit: false };
}

function parseMaxLtvBps(text: string): { bps: number; wasExplicit: boolean } {
  const patterns = [
    /max(?:imum)?\s*ltv\D{0,10}(\d{1,3})\s*%/i,
    /(?:above|over|exceed)\D{0,15}?(\d{1,3})\s*%/i,
    /(\d{1,3})\s*%\s*ltv/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const pct = parseInt(m[1], 10);
      if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
        return { bps: pct * 100, wasExplicit: true };
      }
    }
  }
  return { bps: DEFAULT_MAX_LTV_BPS, wasExplicit: false };
}

function parseRecipient(text: string): PublicKey | null {
  const m = text.match(BASE58_PUBKEY_RE);
  if (!m) return null;
  try {
    return new PublicKey(m[0]);
  } catch {
    return null; // matched base58-looking text that isn't a valid 32-byte key
  }
}

/** Looks for "borrow against TICKER" and returns the bare ticker
 * (NVDA, not NVDAx) if found. */
function parseBorrowFallbackTicker(text: string): string | null {
  const m = text.match(/borrow\s+against\s+([A-Za-z]{2,6})/i);
  if (!m) return null;
  return m[1].toUpperCase().replace(/X$/, "");
}

export async function compileIntent(input: CompileIntentInput): Promise<CompileIntentResult> {
  const { text, owner, nextFlowId } = input;
  const summary: string[] = [];
  let confidence = 1.0;

  const { kind: actionKind } = parseActionKind(text);
  const amountUnits = parseAmountUnits(text);

  if (amountUnits === null && actionKind !== "Repay") {
    throw new Error(
      "compileIntent: couldn't find a dollar amount (e.g. \"$500\") in the " +
        "instruction. Use the structured form instead, or rephrase with an " +
        "explicit amount."
    );
  }
  const amount = amountUnits ?? 0n;

  const action: Action =
    actionKind === "Pay"
      ? { kind: "Pay", amount }
      : actionKind === "Borrow"
      ? { kind: "Borrow", amount }
      : { kind: "Repay", amount };
  summary.push(`Action: ${actionKind} ${(Number(amount) / 10 ** USDC_DECIMALS).toFixed(2)} USDC`);

  const { trigger, wasExplicit: triggerExplicit } = parseTrigger(text);
  if (trigger.kind === "TimeInterval") {
    summary.push(`Trigger: every ${trigger.intervalSeconds / 86400} day(s)`);
  } else {
    summary.push("Trigger: on demand (no recurring schedule found in the text)");
    if (!triggerExplicit) confidence -= 0.1;
  }

  const { bps: maxLtvBps, wasExplicit: ltvExplicit } = parseMaxLtvBps(text);
  summary.push(`Max LTV: ${(maxLtvBps / 100).toFixed(0)}%${ltvExplicit ? "" : " (default — not stated in the text)"}`);
  if (!ltvExplicit) confidence -= 0.15;

  let source: Source = { kind: "StablecoinOnly" };
  const borrowTicker = parseBorrowFallbackTicker(text);
  const mentionsFallback = borrowTicker !== null || /if\s+(insufficient|needed|short)/i.test(text);

  if (mentionsFallback && borrowTicker) {
    try {
      const collateralMint = resolveXStockMint(borrowTicker);
      source = { kind: "StablecoinThenBorrow", collateralMint };
      summary.push(`Source: USDC first, then borrow against ${borrowTicker}x`);
    } catch {
      // Honest degrade, not a fabricated mint: we heard the request but
      // can't safely compile it yet (see resolveXStockMint's own error).
      summary.push(
        `⚠ Requested borrow-against-${borrowTicker} fallback, but no verified ` +
          `devnet mint is configured for ${borrowTicker} yet — compiled as ` +
          `USDC-only instead. Add it to KNOWN_DEVNET_MINTS once confirmed ` +
          `(see docs/FEASIBILITY.md), or use the structured form.`
      );
      confidence -= 0.25;
    }
  } else {
    summary.push("Source: USDC balance only");
  }

  const recipient = parseRecipient(text);
  let destination: PublicKey;

  if (actionKind === "Pay") {
    if (!recipient) {
      throw new Error(
        "compileIntent: this is a Pay action but no recipient wallet " +
          "address was found in the text. Add a full base58 address, or " +
          "use the structured form to pick a recipient."
      );
    }
    destination = recipient;
    summary.push(`Recipient: ${recipient.toBase58()} (enforced on-chain via Flow.destination)`);
  } else {
    // Borrow/Repay don't use `destination` on-chain (see
    // execute_flow.rs) — the owner itself is a harmless placeholder,
    // not a meaningful choice.
    destination = owner;
  }

  const constraints: Constraints = {
    maxAmount: amount,
    maxLtvBps,
  };

  const spec: FlowSpec = {
    flowId: nextFlowId,
    owner,
    trigger,
    action,
    source,
    constraints,
    destination,
  };

  return { spec, summary, confidence: Math.max(0, Math.min(1, confidence)) };
}
