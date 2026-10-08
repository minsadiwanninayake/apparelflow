import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSewingQueue } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Sewing Queue — Sewing Supervisor only.
 * Returns ONLY orders with status = 'VERIFIED'. Query params are ignored on purpose,
 * so /api/sewing/queue?status=PENDING_VERIFICATION still returns verified orders only.
 */
export async function GET() {
  const { error } = await requireRole("sewing_supervisor");
  if (error) return error;

  const orders = await getSewingQueue();
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}