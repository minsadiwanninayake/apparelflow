/* ---------------------------------------------------------------
 * Pure business rules. No database, no React — easy to unit test.
 * ------------------------------------------------------------- */

export type Light = "GREEN" | "YELLOW" | "RED";

/** Multiplier engine: 50 garments × 2 cuffs = 100 cuffs expected */
export function expectedPieces(targetQty: number, piecesPerGarment: number): number {
  return targetQty * piecesPerGarment;
}

/** Standard fabric for the whole batch, e.g. 50 × 1.8 = 90 yds */
export function standardFabricYards(targetQty: number, stdYardsPerPiece: number): number {
  return Math.round(targetQty * stdYardsPerPiece * 100) / 100;
}

/** Human-readable order number, e.g. CO-20261008-4F7A2C */
export function generateOrderNo(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `CO-${date}-${rand}`;
}

/**
 * Traffic-light status matrix (brief section 7.3)
 *   GREEN  — actual == expected (match)
 *   YELLOW — actual  > expected (excess, batch may proceed)
 *   RED    — actual  < expected (shortage, approval blocked)
 */
export function lightFor(expected: number, actual: number): Light {
  if (actual === expected) return "GREEN";
  if (actual > expected) return "YELLOW";
  return "RED";
}

/**
 * Fabric wastage % compared to the recipe standard.
 * e.g. 92.5 yds used vs 90 yds standard = +2.78 %
 */
export function wastagePct(actualYds: number, stdYdsPerPiece: number, targetQty: number): number {
  const standard = stdYdsPerPiece * targetQty;
  if (standard <= 0) return 0;
  return Math.round(((actualYds - standard) / standard) * 10000) / 100;
}

type CountableItem = {
  id: number;
  componentId: number;
  componentName: string;
  expectedQty: number;
};

export type CountResult = {
  itemId: number;
  componentId: number;
  componentName: string;
  expected: number;
  actual: number | null;
  light: Light | null;
  variance: number | null;
};

/**
 * Evaluates every component of an order.
 * `blocked` is true if ANY component is RED (short) or not counted —
 * this is the Hard-Stop Gatekeeper Rule (brief section 7.4).
 */
export function evaluateCounts(
  items: CountableItem[],
  counts: Map<number, number>
): { results: CountResult[]; blocked: boolean } {
  const results: CountResult[] = items.map((item) => {
    const actual = counts.has(item.componentId) ? counts.get(item.componentId)! : null;
    return {
      itemId: item.id,
      componentId: item.componentId,
      componentName: item.componentName,
      expected: item.expectedQty,
      actual,
      light: actual === null ? null : lightFor(item.expectedQty, actual),
      variance: actual === null ? null : actual - item.expectedQty,
    };
  });

  const blocked = results.some((r) => r.light === null || r.light === "RED");
  return { results, blocked };
}