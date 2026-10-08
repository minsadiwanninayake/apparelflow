import type { OrderStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/session";
import { expectedPieces, generateOrderNo } from "@/lib/domain";
import { authState } from "./auth-state";

/** Signs a real JWT for the seeded user with this role and "logs in" */
export async function loginAs(role: Role) {
  const user = await prisma.user.findFirstOrThrow({ where: { role } });
  authState.token = await createSessionToken({
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
  });
  return user;
}

export function logout() {
  authState.token = undefined;
}

/**
 * Creates a REC-BL01 order directly in the database with the given status.
 * 10 garments → 18 yds standard; 18.5 yds used → +2.78% wastage.
 */
export async function createOrder(status: OrderStatus, targetQty = 10) {
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { recipeCode: "REC-BL01" },
    include: { components: { orderBy: { id: "asc" } } },
  });
  const supervisor = await prisma.user.findFirstOrThrow({ where: { role: "cutting_supervisor" } });

  return prisma.cuttingOrder.create({
    data: {
      orderNo: generateOrderNo(),
      recipeId: recipe.id,
      targetQty,
      fabricRollId: "FAB-TEST-001",
      actualFabricYds: 18.5,
      status,
      createdById: supervisor.id,
      items: {
        create: recipe.components.map((c) => ({
          componentId: c.id,
          expectedQty: expectedPieces(targetQty, c.piecesPerGarment),
        })),
      },
    },
    include: { items: { orderBy: { componentId: "asc" } } },
  });
}

type OrderWithItems = Awaited<ReturnType<typeof createOrder>>;

/** Counts that exactly match every expected quantity (all GREEN) */
export function exactCounts(order: OrderWithItems) {
  return order.items.map((i) => ({ componentId: i.componentId, actualQty: i.expectedQty }));
}

export function postJson(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Next.js 16 route context: params is a Promise */
export function ctx(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}