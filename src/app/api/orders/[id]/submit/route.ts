import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * Supervisor sends an order to the QC station.
 * Allowed: CUTTING_IN_PROGRESS -> PENDING_VERIFICATION
 *          REJECTED            -> PENDING_VERIFICATION (after re-cutting)
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("cutting_supervisor");
  if (error) return error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  const orderId = Number(id);

  const order = await prisma.cuttingOrder.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const submitted = await prisma.$transaction(async (tx) => {
    // Only flips if the status is still allowed (stops double-clicks and races)
    const flipped = await tx.cuttingOrder.updateMany({
      where: { id: orderId, status: { in: ["CUTTING_IN_PROGRESS", "REJECTED"] } },
      data: { status: "PENDING_VERIFICATION" },
    });
    if (flipped.count !== 1) return false;

    // Clear old counts from a previous rejected attempt
    await tx.verificationItem.updateMany({
      where: { orderId },
      data: { actualQty: null, status: null },
    });
    return true;
  });

  if (!submitted) {
    return NextResponse.json(
      { error: `Order cannot be submitted while it is ${order.status}` },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, status: "PENDING_VERIFICATION" });
}