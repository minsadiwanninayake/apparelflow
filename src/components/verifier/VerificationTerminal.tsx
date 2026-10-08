"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  evaluateCounts,
  standardFabricYards,
  wastagePct,
  type Light,
} from "@/lib/domain";
import { MAX_PIECE_COUNT, MIN_REJECTION_NOTE } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import type { PendingOrder } from "@/lib/queries";

/* Colour + icon + text, so status is never shown by colour alone */
const LIGHT_STYLE: Record<Light, { label: string; icon: string; className: string }> = {
  GREEN: { label: "MATCH", icon: "●", className: "border-green-600 bg-green-100 text-green-900" },
  YELLOW: { label: "EXCESS", icon: "▲", className: "border-amber-500 bg-amber-100 text-amber-900" },
  RED: { label: "SHORTAGE", icon: "■", className: "border-red-600 bg-red-100 text-red-900" },
};

export function VerificationTerminal({ orders }: { orders: PendingOrder[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(orders[0]?.id ?? null);
  const [flash, setFlash] = useState<{ kind: "ok" | "rejected"; text: string } | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? orders[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Queue of pending batches */}
      <aside>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Pending batches ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-400 bg-white p-6 text-center text-sm text-gray-700">
            No batches waiting for verification.
          </p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const active = selected?.id === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(o.id);
                      setFlash(null);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-blue-700 bg-blue-50 ring-2 ring-blue-700"
                        : "border-gray-300 bg-white hover:border-gray-500"
                    }`}
                  >
                    <p className="font-mono font-bold text-gray-900">{o.orderNo}</p>
                    <p className="text-sm text-gray-800">
                      {o.recipe.recipeCode} · {o.targetQty} garments
                    </p>
                    <p className="text-xs text-gray-600">Submitted {formatDateTime(o.submittedAt)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Counting panel */}
      <section>
        {flash && (
          <p
            role="status"
            className={`mb-4 rounded-md border px-4 py-3 text-sm font-medium ${
              flash.kind === "ok"
                ? "border-green-500 bg-green-50 text-green-900"
                : "border-red-400 bg-red-50 text-red-900"
            }`}
          >
            {flash.text}
          </p>
        )}

        {selected ? (
          <CountingPanel
            key={selected.id}
            order={selected}
            onDone={(f) => {
              setFlash(f);
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="rounded-lg border border-gray-300 bg-white p-8 text-center text-gray-700">
            Nothing to verify right now.
          </div>
        )}
      </section>
    </div>
  );
}

function CountingPanel({
  order,
  onDone,
}: {
  order: PendingOrder;
  onDone: (f: { kind: "ok" | "rejected"; text: string }) => void;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Parse inputs: only whole numbers count; anything else is "invalid"
  const { valid, invalid } = useMemo(() => {
    const valid = new Map<number, number>();
    const invalid = new Set<number>();
    for (const item of order.items) {
      const raw = (counts[item.componentId] ?? "").trim();
      if (raw === "") continue;
      if (/^\d+$/.test(raw) && Number(raw) <= MAX_PIECE_COUNT) {
        valid.set(item.componentId, Number(raw));
      } else {
        invalid.add(item.componentId);
      }
    }
    return { valid, invalid };
  }, [counts, order.items]);

  const { results, blocked } = evaluateCounts(order.items, valid);

  const shortCount = results.filter((r) => r.light === "RED").length;
  const excessCount = results.filter((r) => r.light === "YELLOW").length;
  const uncountedCount = results.filter((r) => r.actual === null && !invalid.has(r.componentId)).length;

  const canApprove = !blocked && invalid.size === 0 && busy === null;
  const noteOk = note.trim().length >= MIN_REJECTION_NOTE;

  const stdYds = standardFabricYards(order.targetQty, order.recipe.stdFabricYards);
  const wastage = wastagePct(order.actualFabricYds, order.recipe.stdFabricYards, order.targetQty);
  const overCap = wastage > order.recipe.wastageCap;

  async function send(kind: "approve" | "reject") {
    setBusy(kind);
    setServerError(null);

    const countsPayload = Array.from(valid, ([componentId, actualQty]) => ({ componentId, actualQty }));
    const body =
      kind === "approve" ? { counts: countsPayload } : { rejectionNote: note, counts: countsPayload };

    try {
      const res = await fetch(`/api/orders/${order.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstField = data.fieldErrors ? Object.values(data.fieldErrors)[0] : null;
        setServerError((firstField as string) ?? data.error ?? "Request failed");
        return;
      }
      onDone(
        kind === "approve"
          ? { kind: "ok", text: `Batch ${order.orderNo} VERIFIED and released to the Sewing Queue.` }
          : { kind: "rejected", text: `Batch ${order.orderNo} REJECTED and returned to the Cutting Supervisor.` }
      );
      router.refresh();
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white shadow-sm">
      {/* Order header */}
      <div className="border-b border-gray-300 p-5">
        <h2 className="font-mono text-xl font-bold text-gray-900">{order.orderNo}</h2>
        <p className="mt-1 text-sm text-gray-800">
          {order.recipe.recipeCode} — {order.recipe.name} · <strong>{order.targetQty}</strong> garments · Roll{" "}
          <span className="font-mono">{order.fabricRollId}</span> · Cut by {order.createdBy}
        </p>
        <p className="mt-2 text-sm text-gray-800">
          Fabric: <strong>{order.actualFabricYds} yds</strong> used vs {stdYds} yds standard ={" "}
          <span
            className={`rounded px-1.5 py-0.5 font-semibold ${
              overCap ? "bg-red-100 text-red-900" : "bg-gray-100 text-gray-900"
            }`}
          >
            {wastage > 0 ? "+" : ""}
            {wastage}% wastage
          </span>{" "}
          <span className="text-gray-700">(cap {order.recipe.wastageCap}%)</span>
          {overCap && <span className="ml-1 font-semibold text-red-800">— over cap</span>}
        </p>
      </div>

      {/* Count table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-700">
            <tr>
              <th className="px-5 py-3 font-medium">Component</th>
              <th className="px-3 py-3 text-right font-medium">Expected</th>
              <th className="px-3 py-3 font-medium">Counted</th>
              <th className="px-3 py-3 text-right font-medium">Variance</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isInvalid = invalid.has(r.componentId);
              const inputId = `count-${r.componentId}`;
              return (
                <tr key={r.componentId} className="border-t border-gray-200 align-top">
                  <td className="px-5 py-3 text-gray-900">
                    <label htmlFor={inputId}>{r.componentName}</label>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">{r.expected}</td>
                  <td className="px-3 py-3">
                    <input
                      id={inputId}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={counts[r.componentId] ?? ""}
                      onChange={(e) => setCounts((c) => ({ ...c, [r.componentId]: e.target.value }))}
                      aria-invalid={isInvalid}
                      aria-describedby={isInvalid ? `${inputId}-error` : undefined}
                      className={`w-28 rounded-md border bg-white px-2 py-1.5 text-right text-gray-900 ${
                        isInvalid ? "border-red-600" : "border-gray-500"
                      }`}
                    />
                    {isInvalid && (
                      <p id={`${inputId}-error`} className="mt-1 text-xs font-medium text-red-700">
                        Whole numbers only
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-gray-900">
                    {r.variance === null ? "—" : r.variance > 0 ? `+${r.variance}` : r.variance}
                  </td>
                  <td className="px-5 py-3">
                    {r.light ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${LIGHT_STYLE[r.light].className}`}
                      >
                        <span aria-hidden="true">{LIGHT_STYLE[r.light].icon}</span>
                        {LIGHT_STYLE[r.light].label}
                      </span>
                    ) : (
                      <span className="inline-block rounded-full border border-dashed border-gray-500 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                        {isInvalid ? "INVALID" : "NOT COUNTED"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Gatekeeper summary + actions */}
      <div className="space-y-4 border-t border-gray-300 p-5">
        <div aria-live="polite">
          {canApprove ? (
            <p className="rounded-md border border-green-500 bg-green-50 px-4 py-3 text-sm font-medium text-green-900">
              All components counted with no shortages
              {excessCount > 0 ? ` (${excessCount} with excess pieces)` : ""}. Batch can be approved.
            </p>
          ) : (
            <p className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
              Approve blocked:{" "}
              {[
                shortCount > 0 && `${shortCount} component${shortCount > 1 ? "s" : ""} short`,
                uncountedCount > 0 && `${uncountedCount} not counted`,
                invalid.size > 0 && `${invalid.size} invalid`,
              ]
                .filter(Boolean)
                .join(", ") || "processing…"}
              .
            </p>
          )}
        </div>

        {serverError && (
          <p role="alert" className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
            Server: {serverError}
          </p>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => send("approve")}
            disabled={!canApprove}
            className="rounded-md bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {busy === "approve" ? "Approving..." : "Approve Batch"}
          </button>

          <div className="w-full max-w-md space-y-2">
            <label htmlFor="rejection-note" className="block text-sm font-medium text-gray-900">
              Rejection reason (required to reject)
            </label>
            <textarea
              id="rejection-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sleeve Cuffs short by 4 pieces — re-cut required"
              className="w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-700">
                {note.trim().length}/{MIN_REJECTION_NOTE} characters minimum
              </span>
              <button
                type="button"
                onClick={() => send("reject")}
                disabled={!noteOk || busy !== null}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {busy === "reject" ? "Rejecting..." : "Reject Batch"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}