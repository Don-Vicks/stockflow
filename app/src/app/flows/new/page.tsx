"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compileIntent, simulateFlow, createFlow } from "@stockflow/sdk";
import type { CompileIntentResult, SimulationResult } from "@stockflow/sdk";
import { useStockFlow } from "@/hooks/useStockFlow";

// ── types ─────────────────────────────────────────────────────────────────────

type Step = "intent" | "review" | "simulate" | "deploying";

// ── page ──────────────────────────────────────────────────────────────────────

export default function CreateFlowPage() {
  const { client, owner, isConnected } = useStockFlow();
  const router = useRouter();

  // step state
  const [step, setStep] = useState<Step>("intent");
  const [error, setError] = useState<string | null>(null);

  // intent / structured-form state
  const [intent, setIntent] = useState("");
  const [actionKind, setActionKind] = useState<"Pay" | "Borrow" | "Repay">("Pay");
  const [amount, setAmount] = useState("750");
  const [recipient, setRecipient] = useState("");
  const [maxLtv, setMaxLtv] = useState("40");
  const [triggerSel, setTriggerSel] = useState<"monthly" | "weekly" | "daily" | "onDemand">("monthly");
  const [fallbackSel, setFallbackSel] = useState<"borrow-nvda" | "borrow-aapl" | "none">("borrow-nvda");

  // derived from compilation
  const [compiled, setCompiled] = useState<CompileIntentResult | null>(null);
  const [sim, setSim] = useState<SimulationResult | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Build a natural-language string from the structured controls when the
   *  intent textarea is left blank — so the same compileIntent parser is
   *  always the single source of truth. */
  function buildFallbackText(): string {
    const triggerPhrase =
      triggerSel === "monthly" ? "every month"
      : triggerSel === "weekly" ? "every week"
      : triggerSel === "daily" ? "every day"
      : "on demand";

    const fallbackPhrase =
      fallbackSel === "borrow-nvda" ? " Use USDC first, then borrow against NVDA if needed."
      : fallbackSel === "borrow-aapl" ? " Use USDC first, then borrow against AAPL if needed."
      : "";

    const recipientPhrase = recipient.trim() ? ` Send to ${recipient.trim()}.` : "";
    const ltvPhrase = maxLtv ? ` Never exceed ${maxLtv}% LTV.` : "";

    return (
      `${actionKind} $${amount} ${triggerPhrase}.` +
      fallbackPhrase +
      recipientPhrase +
      ltvPhrase
    );
  }

  // ── compile ────────────────────────────────────────────────────────────────

  async function handleCompile() {
    if (!owner) {
      setError("Connect your wallet before creating a Flow.");
      return;
    }
    setError(null);

    const text = intent.trim() || buildFallbackText();
    // Use a simple incrementing ID for now; after IDL is generated the SDK
    // will query the chain for the owner's next unused flow_id.
    const nextFlowId = BigInt(Date.now());

    try {
      const result = await compileIntent({ text, owner, nextFlowId });
      setCompiled(result);
      setStep("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── simulate ───────────────────────────────────────────────────────────────

  async function handleSimulate() {
    if (!client || !owner || !compiled) return;
    setError(null);

    try {
      const result = await simulateFlow(client, owner, compiled.spec);
      setSim(result);
      setStep("simulate");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── deploy ─────────────────────────────────────────────────────────────────

  async function handleDeploy() {
    if (!client || !compiled) return;
    setStep("deploying");
    setError(null);

    try {
      await createFlow(client, compiled.spec);
      router.push("/flows");
    } catch (e: unknown) {
      // createFlow throws until the Anchor IDL is generated (Phase 3).
      // Show the error as a banner rather than crashing — the error
      // message is already actionable ("wire up client.program after
      // anchor build").
      setError(e instanceof Error ? e.message : String(e));
      setStep("simulate"); // stay on simulate so user can read the error
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-paper">Create a Flow</h1>

      {!isConnected && (
        <div className="rounded-md border border-line bg-panel px-4 py-3">
          <p className="font-mono text-xs text-muted">
            Connect your wallet to create a Flow.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-alert bg-panel px-4 py-3">
          <p className="font-mono text-xs text-alert">{error}</p>
        </div>
      )}

      {/* ── Step 1: Intent + structured controls ──────────────────────────── */}
      {(step === "intent" || step === "review" || step === "simulate" || step === "deploying") && (
        <section className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">
            What do you want your portfolio to do?
          </p>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder={`Pay my developer $750 every month. Use USDC first, then borrow against NVDAx if needed. Never go above 40% LTV. Send to 7xK...92P.`}
            rows={3}
            className="w-full rounded-md border border-line bg-panel p-3 font-mono text-sm text-paper placeholder:text-muted focus:border-signal focus:outline-none"
          />
          <p className="font-mono text-xs text-muted">
            Or use the structured controls below — both compile to the same Flow.
          </p>
        </section>
      )}

      {/* Structured controls */}
      {(step === "intent") && (
        <>
          <section className="grid grid-cols-2 gap-4 rounded-md border border-line bg-panel p-5">
            <Field label="Action">
              <select
                className="field-input"
                value={actionKind}
                onChange={(e) => setActionKind(e.target.value as typeof actionKind)}
              >
                <option value="Pay">Pay</option>
                <option value="Borrow">Borrow</option>
                <option value="Repay">Repay</option>
              </select>
            </Field>
            <Field label="When">
              <select
                className="field-input"
                value={triggerSel}
                onChange={(e) => setTriggerSel(e.target.value as typeof triggerSel)}
              >
                <option value="monthly">Every month</option>
                <option value="weekly">Every week</option>
                <option value="daily">Every day</option>
                <option value="onDemand">On demand</option>
              </select>
            </Field>
            <Field label="Amount (USDC)">
              <input
                className="field-input"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="To (wallet address)">
              <input
                className="field-input"
                placeholder="7xK...92P"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </Field>
            <Field label="If USDC is insufficient">
              <select
                className="field-input"
                value={fallbackSel}
                onChange={(e) => setFallbackSel(e.target.value as typeof fallbackSel)}
              >
                <option value="borrow-nvda">Borrow against NVDAx</option>
                <option value="borrow-aapl">Borrow against AAPLx</option>
                <option value="none">Fail — do not borrow</option>
              </select>
            </Field>
            <Field label="Max LTV (%)">
              <input
                className="field-input"
                type="number"
                min="1"
                max="75"
                value={maxLtv}
                onChange={(e) => setMaxLtv(e.target.value)}
              />
            </Field>
          </section>

          <button
            onClick={handleCompile}
            disabled={!isConnected}
            className="btn"
          >
            Continue →
          </button>
        </>
      )}

      {/* ── Step 2: Policy Review (PRD §13) ──────────────────────────────── */}
      {(step === "review" || step === "simulate" || step === "deploying") && compiled && (
        <section className="rounded-md border border-line bg-panel p-5 space-y-4">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">
            Review your Flow
          </p>
          <div className="space-y-2">
            {compiled.summary.map((line, i) => (
              <p
                key={i}
                className={`font-mono text-sm ${
                  line.startsWith("⚠") ? "text-alert" : "text-paper"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
          {compiled.confidence < 0.9 && (
            <p className="font-mono text-xs text-muted border-t border-line pt-3">
              Confidence: {(compiled.confidence * 100).toFixed(0)}% — review
              carefully before deploying.
            </p>
          )}
          {step === "review" && (
            <div className="flex gap-3 pt-2">
              <button onClick={handleSimulate} className="btn">
                Simulate
              </button>
              <button
                onClick={() => { setStep("intent"); setCompiled(null); setSim(null); }}
                className="btn text-muted"
              >
                ← Edit
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Step 3: Simulation (PRD §14–15) ──────────────────────────────── */}
      {(step === "simulate" || step === "deploying") && sim && (
        <section className="space-y-4 rounded-md border border-line bg-panel p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">
            Simulation
          </p>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4">
            <Metric
              label="Projected debt"
              value={`$${sim.projectedDebtUsd.toFixed(2)}`}
            />
            <Metric
              label="Projected LTV"
              value={`${(sim.projectedLtvBps / 100).toFixed(2)}%`}
            />
            <Metric
              label="Risk"
              value={sim.riskStatus}
              valueClass={
                sim.riskStatus === "SAFE"
                  ? "text-signal"
                  : sim.riskStatus === "WARNING"
                  ? "text-yellow-400"
                  : "text-alert"
              }
            />
          </div>

          {/* Stress scenarios */}
          <div className="border-t border-line pt-4">
            <p className="font-mono text-xs uppercase tracking-wide text-muted mb-3">
              Market scenarios
            </p>
            <div className="divide-y divide-line">
              {sim.stressScenarios.map((s) => (
                <div key={s.label} className="ledger-row">
                  <span className="font-mono text-sm text-muted">{s.label}</span>
                  <span className="font-mono text-sm text-paper">
                    {(s.projectedLtvBps / 100).toFixed(1)}%
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      s.status === "SAFE"
                        ? "text-signal"
                        : s.status === "WARNING"
                        ? "text-yellow-400"
                        : "text-alert"
                    }`}
                  >
                    {s.status === "SAFE" ? "✓ SAFE" : `⚠ ${s.status}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deploy button */}
          {step !== "deploying" && (
            <button
              onClick={handleDeploy}
              className="mt-2 w-full rounded-md border border-signal bg-panel py-2 font-mono text-sm text-signal hover:bg-signal hover:text-ink transition-colors"
            >
              Deploy Flow →
            </button>
          )}
          {step === "deploying" && (
            <p className="font-mono text-xs text-muted text-center pt-2">
              Submitting transaction…
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 block">
      <span className="block font-mono text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-paper",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs text-muted">{label}</p>
      <p className={`font-mono text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}
