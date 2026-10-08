"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { SupervisorOrder } from "@/lib/queries";

export function OrderList({ orders }: { orders: SupervisorOrder[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  async function submitForVerification(orderId: number) {
    setBusyId(orderId);
    setErrors((e) => ({ ...e, [orderId]: "" }));
    try {
      const res = await fetch(`/api/orders/${orderId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [orderId]: data.error ?? "Could not submit order" }));
        return;
      }
      router.refresh();
    } catch {
      setErrors((e) => ({ ...e, [orderId]: "Network error. Please try again." }));
    } finally {
      setBusyId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-400 bg-white p-8 text-center text-gray-700">
        No cutting orders yet. Click <strong>+ New Cutting Order</strong> to create one.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((o) => {
        const canSubmit = o.status === "CUTTING_IN_PROGRESS" || o.status === "REJECTED";
        return (
          <li key={o.id} className="rounded-lg border border-gray-300 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-lg font-bold">{o.orderNo}</h3>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 text-sm text-gray-800">
                  {o.recipe.recipeCode} — {o.recipe.name} · <strong>{o.targetQty}</strong> garments · Roll{" "}
                  <span className="font-mono">{o.fabricRollId}</span> · {o.actualFabricYds} yds used
                </p>
                <p className="text-xs text-gray-600">Created {formatDateTime(o.createdAt)}</p>
              </div>

              {canSubmit && (
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => submitForVerification(o.id)}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                >
                  {busyId === o.id
                    ? "Submitting..."
                    : o.status === "REJECTED"
                      ? "Re-submit after re-cut"
                      : "Submit for verification"}
                </button>
              )}
            </div>

            {o.status === "REJECTED" && o.lastRejection && (
              <div className="mt-3 rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
                <p className="font-semibold">
                  Rejected by {o.lastRejection.by} on {formatDateTime(o.lastRejection.at)}
                </p>
                <p className="mt-1">Reason: {o.lastRejection.note}</p>
              </div>
            )}

            {errors[o.id] && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                {errors[o.id]}
              </p>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-800">
                Expected component counts ({o.items.length})
              </summary>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id} className="border-t border-gray-200">
                      <td className="py-1.5">{i.componentName}</td>
                      <td className="py-1.5 text-right font-semibold">{i.expectedQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </li>
        );
      })}
    </ul>
  );
}