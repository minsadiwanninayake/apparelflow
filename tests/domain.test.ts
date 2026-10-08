import { describe, expect, it } from "vitest";
import { evaluateCounts, expectedPieces, lightFor, wastagePct } from "@/lib/domain";
import { ApproveSchema, CreateOrderSchema } from "@/lib/validation";

describe("Multiplier engine", () => {
  it("50 garments × 2 cuffs = 100 cuffs", () => {
    expect(expectedPieces(50, 2)).toBe(100);
  });
});

describe("Traffic-light matrix", () => {
  it("GREEN when actual equals expected", () => expect(lightFor(100, 100)).toBe("GREEN"));
  it("YELLOW when actual is more than expected", () => expect(lightFor(100, 102)).toBe("YELLOW"));
  it("RED when actual is less than expected", () => expect(lightFor(100, 96)).toBe("RED"));
});

describe("Hard-stop evaluation", () => {
  const items = [
    { id: 1, componentId: 1, componentName: "A", expectedQty: 50 },
    { id: 2, componentId: 2, componentName: "B", expectedQty: 100 },
  ];

  it("is not blocked when all are GREEN or YELLOW", () => {
    const { blocked } = evaluateCounts(items, new Map([[1, 50], [2, 101]]));
    expect(blocked).toBe(false);
  });

  it("is blocked when any component is RED", () => {
    const { blocked } = evaluateCounts(items, new Map([[1, 50], [2, 99]]));
    expect(blocked).toBe(true);
  });

  it("is blocked when any component is not counted", () => {
    const { blocked } = evaluateCounts(items, new Map([[1, 50]]));
    expect(blocked).toBe(true);
  });
});

describe("Fabric wastage", () => {
  it("92.5 yds used vs 90 yds standard = +2.78%", () => {
    expect(wastagePct(92.5, 1.8, 50)).toBe(2.78);
  });
  it("is negative when less fabric was used", () => {
    expect(wastagePct(85.5, 1.8, 50)).toBe(-5);
  });
});

describe("Defensive input guards", () => {
  const valid = { recipeId: "1", targetQty: "50", fabricRollId: "FAB-ROLL-882", actualFabricYds: "92.5" };

  it("accepts a valid order", () => {
    expect(CreateOrderSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["5.5", "-3", "abc", "", " ", "1e3", "0"])("rejects target quantity %j", (bad) => {
    expect(CreateOrderSchema.safeParse({ ...valid, targetQty: bad }).success).toBe(false);
  });

  it.each([-1, 2.5, "x"])("rejects piece count %j", (bad) => {
    const result = ApproveSchema.safeParse({ counts: [{ componentId: 1, actualQty: bad }] });
    expect(result.success).toBe(false);
  });
});