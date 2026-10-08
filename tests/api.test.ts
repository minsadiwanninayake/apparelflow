import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { POST as approve } from "@/app/api/orders/[id]/approve/route";
import { POST as reject } from "@/app/api/orders/[id]/reject/route";
import { GET as sewingQueue } from "@/app/api/sewing/queue/route";
import { createOrder, ctx, exactCounts, loginAs, logout, postJson } from "./helpers";

afterAll(async () => {
  logout();
  await prisma.$disconnect();
});

describe("Test 1 — approve when every component is GREEN", () => {
  it("returns 200, sets VERIFIED and writes the immutable audit log", async () => {
    const verifier = await loginAs("cutting_verifier");
    const order = await createOrder("PENDING_VERIFICATION");

    const res = await approve(
      postJson(`/api/orders/${order.id}/approve`, { counts: exactCounts(order) }),
      ctx(order.id)
    );
    expect(res.status).toBe(200);

    const saved = await prisma.cuttingOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, logs: true },
    });
    expect(saved.status).toBe("VERIFIED");
    expect(saved.items.every((i) => i.status === "GREEN")).toBe(true);

    expect(saved.logs).toHaveLength(1);
    const log = saved.logs[0];
    expect(log.decision).toBe("APPROVED");
    expect(log.verifierId).toBe(verifier.id); // taken from the session, not the body
    expect(Number(log.wastagePct)).toBeCloseTo(2.78, 2);
    expect(Array.isArray(log.variances)).toBe(true);
  });
});

describe("Test 2 — hard stop when any component is RED", () => {
  it("returns 422 and leaves the order PENDING_VERIFICATION", async () => {
    await loginAs("cutting_verifier");
    const order = await createOrder("PENDING_VERIFICATION");

    const counts = exactCounts(order);
    counts[0].actualQty -= 1; // one piece short → RED

    const res = await approve(postJson(`/api/orders/${order.id}/approve`, { counts }), ctx(order.id));
    expect(res.status).toBe(422);

    const saved = await prisma.cuttingOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { logs: true },
    });
    expect(saved.status).toBe("PENDING_VERIFICATION");
    expect(saved.logs).toHaveLength(0);
  });

  it("returns 422 when a component is not counted at all", async () => {
    await loginAs("cutting_verifier");
    const order = await createOrder("PENDING_VERIFICATION");

    const counts = exactCounts(order).slice(1); // first component missing

    const res = await approve(postJson(`/api/orders/${order.id}/approve`, { counts }), ctx(order.id));
    expect(res.status).toBe(422);

    const saved = await prisma.cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe("PENDING_VERIFICATION");
  });
});

describe("Test 3 — reject requires a reason", () => {
  it.each([
    ["empty string", ""],
    ["only spaces", "     "],
    ["missing", undefined],
  ])("returns 422 when the note is %s", async (_label, note) => {
    await loginAs("cutting_verifier");
    const order = await createOrder("PENDING_VERIFICATION");

    const res = await reject(
      postJson(`/api/orders/${order.id}/reject`, { rejectionNote: note }),
      ctx(order.id)
    );
    expect(res.status).toBe(422);

    const saved = await prisma.cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe("PENDING_VERIFICATION");
  });

  it("returns 200 and sets REJECTED when a proper reason is given", async () => {
    await loginAs("cutting_verifier");
    const order = await createOrder("PENDING_VERIFICATION");

    const res = await reject(
      postJson(`/api/orders/${order.id}/reject`, { rejectionNote: "Sleeve Cuffs short, re-cut needed" }),
      ctx(order.id)
    );
    expect(res.status).toBe(200);

    const saved = await prisma.cuttingOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { logs: true },
    });
    expect(saved.status).toBe("REJECTED");
    expect(saved.logs[0].rejectionNote).toBe("Sleeve Cuffs short, re-cut needed");
  });
});

describe("Test 4 — server-side RBAC on approval", () => {
  it.each(["cutting_supervisor", "sewing_supervisor"] as const)(
    "returns 403 for role %s and does not change the order",
    async (role) => {
      await loginAs(role);
      const order = await createOrder("PENDING_VERIFICATION");

      const res = await approve(
        postJson(`/api/orders/${order.id}/approve`, { counts: exactCounts(order) }),
        ctx(order.id)
      );
      expect(res.status).toBe(403);

      const saved = await prisma.cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(saved.status).toBe("PENDING_VERIFICATION");
    }
  );

  it("returns 401 when not logged in", async () => {
    logout();
    const order = await createOrder("PENDING_VERIFICATION");

    const res = await approve(
      postJson(`/api/orders/${order.id}/approve`, { counts: exactCounts(order) }),
      ctx(order.id)
    );
    expect(res.status).toBe(401);
  });
});

describe("Test 5 — Sewing Queue query isolation", () => {
  it("returns only VERIFIED orders, never pending, rejected or in-progress ones", async () => {
    await loginAs("sewing_supervisor");

    const cutting = await createOrder("CUTTING_IN_PROGRESS");
    const pending = await createOrder("PENDING_VERIFICATION");
    const rejected = await createOrder("REJECTED");
    const verified = await createOrder("VERIFIED");
    const sewing = await createOrder("SEWING_IN_PROGRESS");

    const res = await sewingQueue();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { orders: { id: number; status: string }[] };
    const ids = body.orders.map((o) => o.id);

    expect(body.orders.length).toBeGreaterThan(0);
    expect(body.orders.every((o) => o.status === "VERIFIED")).toBe(true);
    expect(ids).toContain(verified.id);
    for (const hidden of [cutting, pending, rejected, sewing]) {
      expect(ids).not.toContain(hidden.id);
    }
  });

  it("returns 403 for a non-sewing role", async () => {
    await loginAs("cutting_verifier");
    const res = await sewingQueue();
    expect(res.status).toBe(403);
  });
});

describe("Bonus — audit log is append-only at the database level", () => {
  it("rejects any UPDATE on verification_logs", async () => {
    await loginAs("cutting_verifier");
    const order = await createOrder("PENDING_VERIFICATION");
    await approve(
      postJson(`/api/orders/${order.id}/approve`, { counts: exactCounts(order) }),
      ctx(order.id)
    );

    await expect(
      prisma.verificationLog.updateMany({
        where: { orderId: order.id },
        data: { rejectionNote: "tampered" },
      })
    ).rejects.toThrow(/append-only/);
  });
});