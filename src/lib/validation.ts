import { z } from "zod";

/**
 * Whole number only. Rejects "5.5", "-3", "abc", "", "1e3", " ".
 * Accepts a string (from a form) or a number (from an API client).
 */
export function wholeNumber(label: string, min: number, max: number) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const raw = String(value).trim();
    if (raw === "") {
      ctx.addIssue({ code: "custom", message: `${label} is required` });
      return z.NEVER;
    }
    if (!/^\d+$/.test(raw)) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must be a whole number (no decimals, minus signs or letters)`,
      });
      return z.NEVER;
    }
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}` });
      return z.NEVER;
    }
    return n;
  });
}

/** Positive yards with up to 2 decimal places, e.g. 92 or 92.75 */
export function yards(label: string, max: number) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const raw = String(value).trim();
    if (raw === "") {
      ctx.addIssue({ code: "custom", message: `${label} is required` });
      return z.NEVER;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must be a positive number with up to 2 decimal places`,
      });
      return z.NEVER;
    }
    const n = Number(raw);
    if (n <= 0 || n > max) {
      ctx.addIssue({ code: "custom", message: `${label} must be greater than 0 and at most ${max}` });
      return z.NEVER;
    }
    return n;
  });
}

/* ---------------- Cutting orders ---------------- */

export const CreateOrderSchema = z.object({
  recipeId: wholeNumber("Recipe", 1, 1_000_000),
  targetQty: wholeNumber("Target quantity", 1, 10_000),
  fabricRollId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9][A-Z0-9-]{2,39}$/,
      "Fabric Roll ID must be 3–40 letters, numbers or dashes (e.g. FAB-ROLL-882)"
    ),
  actualFabricYds: yards("Actual fabric used", 100_000),
});

export type CreateOrderField = keyof z.input<typeof CreateOrderSchema>;

/* ---------------- Verification ---------------- */

export const MAX_PIECE_COUNT = 1_000_000;

const CountEntry = z.object({
  componentId: wholeNumber("Component", 1, 1_000_000_000),
  actualQty: wholeNumber("Counted pieces", 0, MAX_PIECE_COUNT),
});

export const ApproveSchema = z.object({
  counts: z.array(CountEntry).min(1, "Counts are required for every component"),
});

export const MIN_REJECTION_NOTE = 10;

export const RejectSchema = z.object({
  rejectionNote: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .trim()
      .min(MIN_REJECTION_NOTE, `Rejection reason must be at least ${MIN_REJECTION_NOTE} characters`)
      .max(1000, "Rejection reason must be at most 1000 characters")
  ),
  counts: z.array(CountEntry).optional(),
});

/* ---------------- Helpers ---------------- */

/** Turns a Zod error into { fieldName: "first error message" } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}