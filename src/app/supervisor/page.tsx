import { requirePageRole } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CreateOrderModal } from "@/components/supervisor/CreateOrderModal";
import { OrderList } from "@/components/supervisor/OrderList";
import { getRecipes, getSupervisorOrders } from "@/lib/queries";

export default async function SupervisorPage() {
  const user = await requirePageRole("cutting_supervisor");
  const [recipes, orders] = await Promise.all([getRecipes(), getSupervisorOrders()]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cutting Orders</h1>
            <p className="mt-1 text-gray-700">
              Create batches, log fabric usage, and send finished cuts to the QC station.
            </p>
          </div>
          <CreateOrderModal recipes={recipes} />
        </div>
        <OrderList orders={orders} />
      </main>
    </div>
  );
}