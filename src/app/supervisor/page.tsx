import { requirePageRole } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function SupervisorPage() {
  const user = await requirePageRole("cutting_supervisor");

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Cutting Supervisor</h1>
        <p className="mt-2 text-gray-700">Order creation will be added in the next feature.</p>
      </main>
    </div>
  );
}