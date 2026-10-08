import { requirePageRole } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function SewingPage() {
  const user = await requirePageRole("sewing_supervisor");

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Sewing Queue</h1>
        <p className="mt-2 text-gray-700">Verified batches will appear here in a later feature.</p>
      </main>
    </div>
  );
}