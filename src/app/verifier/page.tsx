import { requirePageRole } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { VerificationTerminal } from "@/components/verifier/VerificationTerminal";
import { getPendingOrders } from "@/lib/queries";

export default async function VerifierPage() {
  const user = await requirePageRole("cutting_verifier");
  const orders = await getPendingOrders();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Verification Terminal</h1>
        <p className="mt-1 mb-6 text-gray-700">
          Count every component. Approval is locked while any component is short or not counted.
        </p>
        <VerificationTerminal orders={orders} />
      </main>
    </div>
  );
}