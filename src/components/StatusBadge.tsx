import type { OrderStatus } from "@prisma/client";

const STYLES: Record<OrderStatus, { label: string; className: string }> = {
  CUTTING_IN_PROGRESS: {
    label: "Cutting in progress",
    className: "border-gray-400 bg-gray-100 text-gray-900",
  },
  PENDING_VERIFICATION: {
    label: "Pending verification",
    className: "border-amber-500 bg-amber-100 text-amber-900",
  },
  REJECTED: {
    label: "Rejected",
    className: "border-red-500 bg-red-100 text-red-900",
  },
  VERIFIED: {
    label: "Verified",
    className: "border-green-600 bg-green-100 text-green-900",
  },
  SEWING_IN_PROGRESS: {
    label: "Sewing in progress",
    className: "border-blue-500 bg-blue-100 text-blue-900",
  },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}