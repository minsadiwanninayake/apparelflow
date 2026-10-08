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