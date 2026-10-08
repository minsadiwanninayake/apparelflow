"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ label = "Log out" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="rounded-md border border-gray-400 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-60"
    >
      {busy ? "Signing out..." : label}
    </button>
  );
}