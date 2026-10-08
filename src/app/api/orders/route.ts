import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { CreateOrderSchema, fieldErrors } from "@/lib/validation";
import { expectedPieces, generateOrderNo } from "@/lib/domain";
import { getSupervisorOrders } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** List orders — Cutting Supervisor only */
export async function GET() {
  const { error } = await requireRole("cutting_supervisor");
  if (error) return error;

  const orders = await getSupervisorOrders();
  return NextResponse.json({ orders });
}

/** Create a cutting order — Cutting Supervisor only */
export async function POST(req: Request) {
  const { user, error } = await requireRole("cutting_supervisor");
  if (error) return error;

  const parsed = CreateOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order details", fieldErrors: fieldErrors(parsed.error) },
      { status: 422 }
    );
  }

  const { recipeId, targetQty, fabricRollId, actualFabricYds } = parsed.data;

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { components: true },
  });
  if (!recipe || recipe.components.length === 0) {
    return NextResponse.json(
      { error: "Invalid order details", fieldErrors: { recipeId: "Recipe not found" } },
      { status: 422 }
    );
  }

  // Order + all expected component counts are created together (one transaction)
  const order = await prisma.cuttingOrder.create({
    data: {
      orderNo: generateOrderNo(),
      recipeId,
      targetQty,
      fabricRollId,
      actualFabricYds,
      status: "CUTTING_IN_PROGRESS",
      createdById: user.id, // from the session cookie, never from the request body
      items: {
        create: recipe.components.map((c) => ({
          componentId: c.id,
          expectedQty: expectedPieces(targetQty, c.piecesPerGarment),
        })),
      },
    },
  });

  return NextResponse.json(
    { order: { id: order.id, orderNo: order.orderNo, status: order.status } },
    { status: 201 }
  );
}