import type { Tier, Usage } from "./types";

/**
 * USD pro 1 Million Tokens, GPT-6.1 Sol.
 * Ultrafast: laut OpenAI-Ankündigung vom 08.10.2026 ($12 / $60).
 * Standard: laut Modellverzeichnis bis 272.000 Eingabe-Tokens ($2 / $10, Cache-Lesen $0,10).
 * Nur zur Anzeige im Testlabor. Maßgeblich ist die OpenAI-Abrechnung.
 */
const PRICES: Record<Tier, { input: number; cached: number; output: number }> = {
  ultrafast: { input: 12, cached: 12, output: 60 },
  standard: { input: 2, cached: 0.1, output: 10 },
};

export function estimateCost(tier: Tier, usage: Usage | null): number | null {
  if (!usage) return null;
  const p = PRICES[tier];
  const fresh = Math.max(0, usage.input - usage.cached);
  return (fresh * p.input + usage.cached * p.cached + usage.output * p.output) / 1_000_000;
}
