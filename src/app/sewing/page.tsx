import { requirePageRole } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { SewingBoard } from "@/components/sewing/SewingBoard";
import { getSewingInProgress, getSewingQueue } from "@/lib/queries";

export default async function SewingPage() {
  const user = await requirePageRole("sewing_supervisor");
  const [queue, inProgress] = await Promise.all([getSewingQueue(), getSewingInProgress()]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Sewing Queue</h1>
        <p className="mt-1 mb-6 text-gray-700">
          Only batches that passed QC verification appear here, with their audit record.
        </p>
        <SewingBoard queue={queue} inProgress={inProgress} />
      </main>
    </div>
  );
}