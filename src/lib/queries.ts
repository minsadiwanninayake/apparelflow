import { prisma } from "@/lib/db";

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