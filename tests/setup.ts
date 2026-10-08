import { vi } from "vitest";

// Safety guard: never run tests against the real database
if (process.env.APP_ENV !== "test") {
  throw new Error("Refusing to run tests: APP_ENV is not 'test'. Check .env.test");
}

// Route handlers read the session from cookies(). Outside a real request there are
// no cookies, so we replace next/headers with a fake that returns our test token.
// Everything else (JWT verification, role checks) runs for real.
vi.mock("next/headers", async () => {
  const { authState } = await import("./auth-state");
  return {
    cookies: async () => ({
      get: (name: string) => (authState.token ? { name, value: authState.token } : undefined),
    }),
  };
});