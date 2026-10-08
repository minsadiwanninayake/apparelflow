"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_PASSWORD = "Demo@1234";

const DEMO_ACCOUNTS = [
  {
    label: "Cutting Supervisor",
    email: "supervisor@apparelflow.dev",
    description: "Creates cutting orders and logs fabric usage.",
  },
  {
    label: "Cutting Verifier",
    email: "verifier@apparelflow.dev",
    description: "Counts pieces, approves or rejects batches.",
  },
  {
    label: "Sewing Supervisor",
    email: "sewing@apparelflow.dev",
    description: "Sees only verified batches and starts sewing.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.replace(data.redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10 text-gray-900">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        {/* Login form */}
        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">ApparelFlow ERP</h1>
          <p className="mt-1 text-gray-700">Cutting Operations &amp; Gatekeeper Verification</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              login(email, password);
            }}
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-gray-900"
                placeholder="you@apparelflow.dev"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-gray-900"
                required
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>

        {/* Demo Credential Panel / Role Switcher */}
        <section className="rounded-lg border border-blue-300 bg-blue-50 p-6">
          <h2 className="text-lg font-bold">Demo Credential Panel</h2>
          <p className="mt-1 text-sm text-gray-800">
            Click a role to sign in instantly. Password for all accounts:{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-gray-900">{DEMO_PASSWORD}</code>
          </p>

          <ul className="mt-4 space-y-3">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.email} className="rounded-md border border-gray-300 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{acc.label}</p>
                    <p className="font-mono text-sm text-gray-700">{acc.email}</p>
                    <p className="mt-1 text-sm text-gray-700">{acc.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => login(acc.email, DEMO_PASSWORD)}
                    className="shrink-0 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                  >
                    Log in
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}