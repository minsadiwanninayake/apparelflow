"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { SewingOrder } from "@/lib/queries";

const VARIANCE_STYLE: Record<string, string> = {
  GREEN: "text-green-800",
  YELLOW: "text-amber-800",
  RED: "text-red-800",
};

export function SewingBoard({
  queue,
  inProgress,
}: {
  queue: SewingOrder[];
  inProgress: SewingOrder[];
}) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          Ready for sewing ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-400 bg-white p-8 text-center text-gray-700">
            No verified batches waiting. Batches appear here only after they pass QC.
          </p>
        ) : (
          <ul className="space-y-4">
            {queue.map((o) => (
              <SewingCard key={o.id} order={o} canStart />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          On the assembly line ({inProgress.length})
        </h2>
        {inProgress.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-400 bg-white p-6 text-center text-sm text-gray-700">
            Nothing is being sewn right now.
          </p>
        ) : (
          <ul className="space-y-4">
            {inProgress.map((o) => (
              <SewingCard key={o.id} order={o} canStart={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SewingCard({ order, canStart }: { order: SewingOrder; canStart: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const a = order.approval;
  const overCap = a?.wastagePct != null && a.wastagePct > order.recipe.wastageCap;

  async function startSewing() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sewing/${order.id}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-gray-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-lg font-bold text-gray-900">{order.orderNo}</h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-gray-800">
            {order.recipe.recipeCode} — {order.recipe.name} · <strong>{order.targetQty}</strong> garments ·
            Roll <span className="font-mono">{order.fabricRollId}</span>
          </p>
        </div>

        {canStart && (
          <button
            type="button"
            onClick={startSewing}
            disabled={busy}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {busy ? "Starting..." : "Start Sewing"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Immutable audit trail from the verification log */}
      {a ? (
        <div className="mt-4 rounded-md border border-gray-300 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">QC audit record</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-700">Verified by</dt>
              <dd className="font-medium text-gray-900">
                {a.verifierName} <span className="text-gray-600">(ID {a.verifierId})</span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-700">Verified at</dt>
              <dd className="font-medium text-gray-900">{formatDateTime(a.at)}</dd>
            </div>
            <div>
              <dt className="text-gray-700">Fabric wastage</dt>
              <dd className={`font-medium ${overCap ? "text-red-800" : "text-gray-900"}`}>
                {a.wastagePct == null ? "—" : `${a.wastagePct > 0 ? "+" : ""}${a.wastagePct}%`}{" "}
                <span className="text-gray-600">(cap {order.recipe.wastageCap}%)</span>
                {overCap && " — over cap"}
              </dd>
            </div>
          </dl>

          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-gray-700">
              <tr>
                <th className="py-1 font-medium">Component</th>
                <th className="py-1 text-right font-medium">Expected</th>
                <th className="py-1 text-right font-medium">Counted</th>
                <th className="py-1 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {a.variances.map((v) => (
                <tr key={v.componentId} className="border-t border-gray-200">
                  <td className="py-1.5 text-gray-900">{v.componentName}</td>
                  <td className="py-1.5 text-right text-gray-900">{v.expected}</td>
                  <td className="py-1.5 text-right text-gray-900">{v.actual}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${VARIANCE_STYLE[v.status] ?? ""}`}>
                    {v.variance > 0 ? `+${v.variance}` : v.variance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-red-800">No approval record found for this batch.</p>
      )}
    </li>
  );
}