"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateOrderSchema, fieldErrors, type CreateOrderField } from "@/lib/validation";
import { expectedPieces, standardFabricYards } from "@/lib/domain";
import type { RecipeDTO } from "@/lib/queries";

type FormState = Record<CreateOrderField, string>;

const EMPTY_FORM: FormState = {
  recipeId: "",
  targetQty: "",
  fabricRollId: "",
  actualFabricYds: "",
};

const inputClass =
  "mt-1 w-full rounded-md border bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500";

export function CreateOrderModal({ recipes }: { recipes: RecipeDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<CreateOrderField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Same rules as the server, run on every keystroke
  const validation = useMemo(() => CreateOrderSchema.safeParse(form), [form]);
  const clientErrors = validation.success ? {} : fieldErrors(validation.error);

  const selectedRecipe = recipes.find((r) => String(r.id) === form.recipeId);
  const qty = /^\d+$/.test(form.targetQty.trim()) ? Number(form.targetQty.trim()) : null;
  const validQty = qty !== null && qty >= 1 && qty <= 10_000 ? qty : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function update(field: CreateOrderField, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setServerErrors((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

  function errorFor(field: CreateOrderField): string | undefined {
    if (serverErrors[field]) return serverErrors[field];
    if (touched[field] || submitAttempted) return clientErrors[field];
    return undefined;
  }

  function close() {
    setOpen(false);
    setForm(EMPTY_FORM);
    setTouched({});
    setSubmitAttempted(false);
    setServerErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!validation.success) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerErrors(data.fieldErrors ?? { form: data.error ?? "Could not create order" });
        return;
      }
      setSuccessMessage(`Order ${data.order.orderNo} created. Submit it for verification when cutting is done.`);
      close();
      router.refresh();
    } catch {
      setServerErrors({ form: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function fieldBorder(field: CreateOrderField) {
    return errorFor(field) ? "border-red-600" : "border-gray-500";
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null);
            setOpen(true);
          }}
          className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
        >
          + New Cutting Order
        </button>
        {successMessage && (
          <p role="status" className="rounded-md border border-green-400 bg-green-50 px-3 py-2 text-sm text-green-900">
            {successMessage}
          </p>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-order-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 text-gray-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 id="create-order-title" className="text-xl font-bold">
                New Cutting Order
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded px-2 text-2xl leading-none text-gray-700 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Recipe */}
              <div>
                <label htmlFor="recipeId" className="block text-sm font-medium">
                  Recipe
                </label>
                <select
                  id="recipeId"
                  value={form.recipeId}
                  onChange={(e) => update("recipeId", e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, recipeId: true }))}
                  className={`${inputClass} ${fieldBorder("recipeId")}`}
                  aria-invalid={!!errorFor("recipeId")}
                  aria-describedby="recipeId-error"
                >
                  <option value="">Select a recipe…</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.recipeCode} — {r.name} ({r.stdFabricYards} yds/piece, cap {r.wastageCap}%)
                    </option>
                  ))}
                </select>
                {errorFor("recipeId") && (
                  <p id="recipeId-error" className="mt-1 text-sm font-medium text-red-700">
                    {errorFor("recipeId")}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Target quantity */}
                <div>
                  <label htmlFor="targetQty" className="block text-sm font-medium">
                    Target quantity (garments)
                  </label>
                  <input
                    id="targetQty"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 50"
                    value={form.targetQty}
                    onChange={(e) => update("targetQty", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, targetQty: true }))}
                    className={`${inputClass} ${fieldBorder("targetQty")}`}
                    aria-invalid={!!errorFor("targetQty")}
                    aria-describedby="targetQty-error"
                  />
                  {errorFor("targetQty") && (
                    <p id="targetQty-error" className="mt-1 text-sm font-medium text-red-700">
                      {errorFor("targetQty")}
                    </p>
                  )}
                </div>

                {/* Fabric roll */}
                <div>
                  <label htmlFor="fabricRollId" className="block text-sm font-medium">
                    Fabric Roll ID
                  </label>
                  <input
                    id="fabricRollId"
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. FAB-ROLL-882"
                    value={form.fabricRollId}
                    onChange={(e) => update("fabricRollId", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, fabricRollId: true }))}
                    className={`${inputClass} ${fieldBorder("fabricRollId")}`}
                    aria-invalid={!!errorFor("fabricRollId")}
                    aria-describedby="fabricRollId-error"
                  />
                  {errorFor("fabricRollId") && (
                    <p id="fabricRollId-error" className="mt-1 text-sm font-medium text-red-700">
                      {errorFor("fabricRollId")}
                    </p>
                  )}
                </div>

                {/* Fabric used */}
                <div>
                  <label htmlFor="actualFabricYds" className="block text-sm font-medium">
                    Actual fabric used (yds)
                  </label>
                  <input
                    id="actualFabricYds"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 92.5"
                    value={form.actualFabricYds}
                    onChange={(e) => update("actualFabricYds", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, actualFabricYds: true }))}
                    className={`${inputClass} ${fieldBorder("actualFabricYds")}`}
                    aria-invalid={!!errorFor("actualFabricYds")}
                    aria-describedby="actualFabricYds-error"
                  />
                  {errorFor("actualFabricYds") && (
                    <p id="actualFabricYds-error" className="mt-1 text-sm font-medium text-red-700">
                      {errorFor("actualFabricYds")}
                    </p>
                  )}
                </div>
              </div>

              {/* Live multiplier preview */}
              {selectedRecipe && (
                <div className="rounded-md border border-gray-300">
                  <div className="border-b border-gray-300 bg-gray-50 px-4 py-2 text-sm font-semibold">
                    Expected component counts {validQty ? `for ${validQty} garments` : "(enter a valid quantity)"}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-700">
                        <th className="px-4 py-2 font-medium">Component</th>
                        <th className="px-4 py-2 text-right font-medium">Pcs / garment</th>
                        <th className="px-4 py-2 text-right font-medium">Expected pieces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecipe.components.map((c) => (
                        <tr key={c.id} className="border-t border-gray-200">
                          <td className="px-4 py-2">{c.componentName}</td>
                          <td className="px-4 py-2 text-right">{c.piecesPerGarment}</td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {validQty ? expectedPieces(validQty, c.piecesPerGarment) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validQty && (
                    <p className="border-t border-gray-200 px-4 py-2 text-sm text-gray-800">
                      Standard fabric for this batch:{" "}
                      <strong>{standardFabricYards(validQty, selectedRecipe.stdFabricYards)} yds</strong>
                    </p>
                  )}
                </div>
              )}

              {serverErrors.form && (
                <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {serverErrors.form}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-gray-400 bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting ? "Creating..." : "Create order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}