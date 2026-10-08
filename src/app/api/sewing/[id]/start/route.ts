import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/** Start sewing: VERIFIED -> SEWING_IN_PROGRESS (Sewing Supervisor only) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("sewing_supervisor");
  if (error) return error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  const orderId = Number(id);

  // Only flips if the order is VERIFIED right now (blocks skipping verification)
  const flipped = await prisma.cuttingOrder.updateMany({
    where: { id: orderId, status: "VERIFIED" },
    data: { status: "SEWING_IN_PROGRESS" },
  });

  if (flipped.count !== 1) {
    const exists = await prisma.cuttingOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Only VERIFIED batches can be started on the sewing line" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, status: "SEWING_IN_PROGRESS" });
}