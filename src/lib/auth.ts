import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { SESSION_COOKIE, ROLE_HOME, verifySessionToken, type SessionUser } from "@/lib/session";

/** Reads the httpOnly cookie and returns the logged-in user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

type GuardResult =
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse };

/**
 * For API routes. Returns 401 if not logged in, 403 if wrong role.
 * Usage:
 *   const { user, error } = await requireRole("cutting_verifier");
 *   if (error) return error;
 */
export async function requireRole(...allowed: Role[]): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Not logged in" }, { status: 401 }),
    };
  }
  if (!allowed.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: `Forbidden: role '${user.role}' cannot perform this action` },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

/** For pages. Sends the user to /login, or to their own home page if the role is wrong. */
export async function requirePageRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}