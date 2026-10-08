import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ApproveSchema, fieldErrors } from "@/lib/validation";
import { evaluateCounts, wastagePct, type Light } from "@/lib/domain";

class StateConflictError extends Error {}

/**
 * Approve a batch. Order of checks:
 *   401 not logged in  ->  403 wrong role  ->  400 bad id  ->  422 bad input
 *   404 no order       ->  409 not pending ->  422 HARD STOP (any RED / uncounted)
 *   then: VERIFIED + item counts + immutable audit log, all in ONE transaction
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // 1. Server-side RBAC
  const { user, error } = await requireRole("cutting_verifier");
  if (error) return error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  const orderId = Number(id);

  // 2. Input validation (whole numbers only, no negatives/decimals)
  const parsed = ApproveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid counts", fieldErrors: fieldErrors(parsed.error) },
      { status: 422 }
    );
  }

  const counts = new Map<number, number>();
  for (const c of parsed.data.counts) {
    if (counts.has(c.componentId)) {
      return NextResponse.json(
        { error: `Component ${c.componentId} was counted twice` },
        { status: 422 }
      );
    }
    counts.set(c.componentId, c.actualQty);
  }

  // 3. Load the order and check its state
  const order = await prisma.cuttingOrder.findUnique({
    where: { id: orderId },
    include: {
      recipe: true,
      items: {
        orderBy: { componentId: "asc" },
        include: { component: { select: { componentName: true } } },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "PENDING_VERIFICATION") {
    return NextResponse.json(
      { error: `Order is ${order.status}, not PENDING_VERIFICATION` },
      { status: 409 }
    );
  }

  const known = new Set(order.items.map((i) => i.componentId));
  for (const componentId of counts.keys()) {
    if (!known.has(componentId)) {
      return NextResponse.json(
        { error: `Component ${componentId} is not part of this order` },
        { status: 422 }
      );
    }
  }

  // 4. HARD STOP — recalculated on the server, never trusted from the client
  const { results, blocked } = evaluateCounts(
    order.items.map((i) => ({
      id: i.id,
      componentId: i.componentId,
      componentName: i.component.componentName,
      expectedQty: i.expectedQty,
    })),
    counts
  );

  if (blocked) {
    return NextResponse.json(
      {
        error: "Approval blocked: one or more components are short (RED) or not counted.",
        results,
      },
      { status: 422 }
    );
  }

  const wastage = wastagePct(
    Number(order.actualFabricYds),
    Number(order.recipe.stdFabricYards),
    order.targetQty
  );

  // 5. Atomic write: status + counts + immutable audit log
  try {
    await prisma.$transaction(async (tx) => {
      // Only flips if still pending — stops double-approve races
      const flipped = await tx.cuttingOrder.updateMany({
        where: { id: orderId, status: "PENDING_VERIFICATION" },
        data: { status: "VERIFIED" },
      });
      if (flipped.count !== 1) throw new StateConflictError();

      for (const r of results) {
        await tx.verificationItem.update({
          where: { id: r.itemId },
          data: { actualQty: r.actual!, status: r.light as Light },
        });
      }

      await tx.verificationLog.create({
        data: {
          orderId,
          verifierId: user.id, // from the session cookie, never from the request body
          decision: "APPROVED",
          wastagePct: wastage,
          variances: results.map((r) => ({
            componentId: r.componentId,
            componentName: r.componentName,
            expected: r.expected,
            actual: r.actual,
            variance: r.variance,
            status: r.light,
          })),
        },
      });
    });
  } catch (e) {
    if (e instanceof StateConflictError) {
      return NextResponse.json({ error: "Order was already processed" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, status: "VERIFIED", wastagePct: wastage, results });
}