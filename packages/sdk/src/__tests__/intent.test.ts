import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { compileIntent } from "../intent";

const owner = Keypair.generate().publicKey;
const recipient = Keypair.generate().publicKey;

test("compileIntent: the PRD's own example parses into a sane FlowSpec", async () => {
  const text = `Pay my developer $500 every month. Use USDC first, then borrow against NVDA if needed. Never go above 40% LTV. Send to ${recipient.toBase58()}.`;
  const result = await compileIntent({ text, owner, nextFlowId: 1n });

  assert.equal(result.spec.action.kind, "Pay");
  if (result.spec.action.kind === "Pay") {
    assert.equal(result.spec.action.amount, 500_000_000n);
  }
  assert.equal(result.spec.trigger.kind, "TimeInterval");
  if (result.spec.trigger.kind === "TimeInterval") {
    assert.equal(result.spec.trigger.intervalSeconds, 30 * 24 * 3600);
  }
  assert.equal(result.spec.constraints.maxLtvBps, 4000);
  assert.equal(result.spec.destination.toBase58(), recipient.toBase58());
  // No xStock devnet mint is configured yet, so this must degrade to
  // StablecoinOnly rather than fabricate a collateral mint — see
  // packages/common/src/config.ts:resolveXStockMint.
  assert.equal(result.spec.source.kind, "StablecoinOnly");
  assert.ok(result.confidence < 1, "confidence should reflect the degraded borrow-fallback");
});

test("compileIntent: on-demand borrow with an explicit LTV and no recipient needed", async () => {
  const text = "Borrow $2000 against my portfolio, never above 35% LTV.";
  const result = await compileIntent({ text, owner, nextFlowId: 2n });

  assert.equal(result.spec.action.kind, "Borrow");
  assert.equal(result.spec.trigger.kind, "OnDemand");
  assert.equal(result.spec.constraints.maxLtvBps, 3500);
  // Borrow doesn't need a recipient — owner is the harmless placeholder.
  assert.equal(result.spec.destination.toBase58(), owner.toBase58());
});

test("compileIntent: a Pay with no dollar amount throws instead of guessing", async () => {
  await assert.rejects(
    () => compileIntent({ text: "Pay my developer every month", owner, nextFlowId: 3n }),
    /couldn't find a dollar amount/
  );
});

test("compileIntent: a Pay with no recipient address throws instead of guessing", async () => {
  await assert.rejects(
    () => compileIntent({ text: "Pay $500 every month", owner, nextFlowId: 4n }),
    /no recipient wallet address/
  );
});

test("compileIntent: unspecified LTV falls back to the documented default with lower confidence", async () => {
  const text = `Pay $100 to ${recipient.toBase58()} every week.`;
  const result = await compileIntent({ text, owner, nextFlowId: 5n });
  assert.equal(result.spec.constraints.maxLtvBps, 4000);
  assert.ok(result.confidence < 1);
});

test("compileIntent: repay doesn't require a recipient at all", async () => {
  const text = "Repay $300 of my debt every month.";
  const result = await compileIntent({ text, owner, nextFlowId: 6n });
  assert.equal(result.spec.action.kind, "Repay");
  assert.equal(result.spec.destination.toBase58(), owner.toBase58());
});
