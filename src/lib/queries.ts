import { prisma } from "@/lib/db";

/* ---------------- Recipes ---------------- */

export async function getRecipes() {
  const recipes = await prisma.recipe.findMany({
    orderBy: { recipeCode: "asc" },
    include: { components: { orderBy: { id: "asc" } } },
  });

  return recipes.map((r) => ({
    id: r.id,
    recipeCode: r.recipeCode,
    name: r.name,
    category: r.category,
    stdFabricYards: Number(r.stdFabricYards),
    wastageCap: Number(r.wastageCap),
    components: r.components.map((c) => ({
      id: c.id,
      componentName: c.componentName,
      piecesPerGarment: c.piecesPerGarment,
    })),
  }));
}

export type RecipeDTO = Awaited<ReturnType<typeof getRecipes>>[number];

/* ---------------- Supervisor ---------------- */

export async function getSupervisorOrders() {
  const orders = await prisma.cuttingOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      recipe: { select: { recipeCode: true, name: true } },
      items: {
        orderBy: { componentId: "asc" },
        include: { component: { select: { componentName: true } } },
      },
      logs: {
        where: { decision: "REJECTED" },
        orderBy: { timestamp: "desc" },
        take: 1,
        include: { verifier: { select: { fullName: true } } },
      },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    targetQty: o.targetQty,
    fabricRollId: o.fabricRollId,
    actualFabricYds: Number(o.actualFabricYds),
    createdAt: o.createdAt.toISOString(),
    recipe: o.recipe,
    items: o.items.map((i) => ({
      id: i.id,
      componentName: i.component.componentName,
      expectedQty: i.expectedQty,
    })),
    lastRejection: o.logs[0]
      ? {
          note: o.logs[0].rejectionNote ?? "",
          by: o.logs[0].verifier.fullName,
          at: o.logs[0].timestamp.toISOString(),
        }
      : null,
  }));
}

export type SupervisorOrder = Awaited<ReturnType<typeof getSupervisorOrders>>[number];

/* ---------------- Verifier ---------------- */

export async function getPendingOrders() {
  const orders = await prisma.cuttingOrder.findMany({
    where: { status: "PENDING_VERIFICATION" },
    orderBy: { updatedAt: "asc" }, // oldest submitted first
    include: {
      recipe: true,
      createdBy: { select: { fullName: true } },
      items: {
        orderBy: { componentId: "asc" },
        include: { component: { select: { componentName: true, piecesPerGarment: true } } },
      },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    targetQty: o.targetQty,
    fabricRollId: o.fabricRollId,
    actualFabricYds: Number(o.actualFabricYds),
    submittedAt: o.updatedAt.toISOString(),
    createdBy: o.createdBy.fullName,
    recipe: {
      recipeCode: o.recipe.recipeCode,
      name: o.recipe.name,
      stdFabricYards: Number(o.recipe.stdFabricYards),
      wastageCap: Number(o.recipe.wastageCap),
    },
    items: o.items.map((i) => ({
      id: i.id,
      componentId: i.componentId,
      componentName: i.component.componentName,
      piecesPerGarment: i.component.piecesPerGarment,
      expectedQty: i.expectedQty,
    })),
  }));
}

export type PendingOrder = Awaited<ReturnType<typeof getPendingOrders>>[number];

/* ---------------- Sewing ---------------- */

export type AuditVariance = {
  componentId: number;
  componentName: string;
  expected: number;
  actual: number;
  variance: number;
  status: "GREEN" | "YELLOW" | "RED";
};

/**
 * Query isolation: the status is a fixed value chosen on the server.
 * It is NEVER read from the URL or request body, so unapproved orders
 * cannot leak to the Sewing Supervisor.
 */
async function getOrdersForSewing(status: "VERIFIED" | "SEWING_IN_PROGRESS") {
  const orders = await prisma.cuttingOrder.findMany({
    where: { status },
    orderBy: { updatedAt: "asc" },
    include: {
      recipe: { select: { recipeCode: true, name: true, wastageCap: true } },
      logs: {
        where: { decision: "APPROVED" },
        orderBy: { timestamp: "desc" },
        take: 1,
        include: { verifier: { select: { fullName: true } } },
      },
    },
  });

  return orders.map((o) => {
    const log = o.logs[0];
    return {
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      targetQty: o.targetQty,
      fabricRollId: o.fabricRollId,
      actualFabricYds: Number(o.actualFabricYds),
      recipe: {
        recipeCode: o.recipe.recipeCode,
        name: o.recipe.name,
        wastageCap: Number(o.recipe.wastageCap),
      },
      approval: log
        ? {
            verifierId: log.verifierId,
            verifierName: log.verifier.fullName,
            at: log.timestamp.toISOString(),
            wastagePct: log.wastagePct === null ? null : Number(log.wastagePct),
            variances: (Array.isArray(log.variances) ? log.variances : []) as unknown as AuditVariance[],
          }
        : null,
    };
  });
}

/** Sewing Queue — VERIFIED only (brief section 9: query isolation) */
export function getSewingQueue() {
  return getOrdersForSewing("VERIFIED");
}

/** Batches already started on the assembly line */
export function getSewingInProgress() {
  return getOrdersForSewing("SEWING_IN_PROGRESS");
}

export type SewingOrder = Awaited<ReturnType<typeof getSewingQueue>>[number];