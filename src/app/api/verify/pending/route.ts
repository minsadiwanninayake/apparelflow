import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getPendingOrders } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Orders waiting at the QC station — Cutting Verifier only */
export async function GET() {
  const { error } = await requireRole("cutting_verifier");
  if (error) return error;

  const orders = await getPendingOrders();
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}