import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { RejectSchema, fieldErrors } from "@/lib/validation";
import { evaluateCounts, wastagePct } from "@/lib/domain";

class StateConflictError extends Error {}

/**
 * Reject a batch with a mandatory reason. It returns to the Cutting Supervisor
 * for re-cutting. Any counts already entered are saved in the audit log.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole("cutting_verifier");
  if (error) return error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  const orderId = Number(id);

  const parsed = RejectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rejection", fieldErrors: fieldErrors(parsed.error) },
      { status: 422 }
    );
  }

  const counts = new Map<number, number>();
  for (const c of parsed.data.counts ?? []) {
    if (counts.has(c.componentId)) {
      return NextResponse.json(
        { error: `Component ${c.componentId} was counted twice` },
        { status: 422 }
      );
    }
    counts.set(c.componentId, c.actualQty);
  }

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

  const { results } = evaluateCounts(
    order.items.map((i) => ({
      id: i.id,
      componentId: i.componentId,
      componentName: i.component.componentName,
      expectedQty: i.expectedQty,
    })),
    counts
  );
  const counted = results.filter((r) => r.actual !== null);

  const wastage = wastagePct(
    Number(order.actualFabricYds),
    Number(order.recipe.stdFabricYards),
    order.targetQty
  );

  try {
    await prisma.$transaction(async (tx) => {
      const flipped = await tx.cuttingOrder.updateMany({
        where: { id: orderId, status: "PENDING_VERIFICATION" },
        data: { status: "REJECTED" },
      });
      if (flipped.count !== 1) throw new StateConflictError();

      for (const r of counted) {
        await tx.verificationItem.update({
          where: { id: r.itemId },
          data: { actualQty: r.actual!, status: r.light! },
        });
      }

      await tx.verificationLog.create({
        data: {
          orderId,
          verifierId: user.id,
          decision: "REJECTED",
          rejectionNote: parsed.data.rejectionNote,
          wastagePct: wastage,
          variances: counted.map((r) => ({
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

  return NextResponse.json({ ok: true, status: "REJECTED" });
}