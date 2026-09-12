import { Droplets, CreditCard, GitMerge, ShieldAlert } from "lucide-react";

const FEATURES = [
  {
    name: "StockFi: Unlock Liquidity",
    description: "Your portfolio shouldn't be a passive holding. Tokenize your stocks, collateralize them, and borrow USDC against your positions instantly.",
    icon: Droplets,
  },
  {
    name: "StockPay: Spend Without Selling",
    description: "Link your borrowing power directly to discretionary payments. If you need cash, borrow against your portfolio instead of selling and triggering taxable events.",
    icon: CreditCard,
  },
  {
    name: "StockFlow: Programmable Portfolio",
    description: "Write automated financial rules. 'If NVDA goes up 10%, take profit and repay USDC debt.' Compose complex triggers directly on Solana.",
    icon: GitMerge,
  },
  {
    name: "Risk Protection Limits",
    description: "Set hard algorithmic limits. If your LTV reaches 35%, automatically freeze discretionary spending to protect your portfolio from liquidation.",
    icon: ShieldAlert,
  },
];

export function Features() {
  return (
    <section className="bg-ink py-24 border-b border-line">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="font-display text-4xl text-paper tracking-tight mb-4">The Operating Layer for Tokenized Equity.</h2>
          <p className="font-mono text-muted text-sm leading-relaxed">
            StockFlow bridges traditional finance and DeFi. We transform static equity into a productive, programmable, and liquid asset class.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.name} className="flex flex-col border border-line bg-panel p-8 rounded-xl hover:border-muted transition-colors">
                <div className="h-12 w-12 rounded-lg bg-ink border border-line flex items-center justify-center mb-6">
                  <Icon className="w-5 h-5 text-signal" />
                </div>
                <h3 className="font-display text-xl text-paper mb-3">{feat.name}</h3>
                <p className="font-mono text-sm text-muted leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
