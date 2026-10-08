import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "af_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours = one work shift

export type SessionUser = {
  id: number;
  role: Role;
  fullName: string;
  email: string;
};

export const ROLE_HOME: Record<Role, string> = {
  cutting_supervisor: "/supervisor",
  cutting_verifier: "/verifier",
  sewing_supervisor: "/sewing",
};

export const ROLE_LABEL: Record<Role, string> = {
  cutting_supervisor: "Cutting Supervisor",
  cutting_verifier: "Cutting Verifier",
  sewing_supervisor: "Sewing Supervisor",
};

const VALID_ROLES: Role[] = ["cutting_supervisor", "cutting_verifier", "sewing_supervisor"];

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, fullName: user.fullName, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    const role = payload.role as Role;
    if (!Number.isInteger(id) || !VALID_ROLES.includes(role)) return null;
    return {
      id,
      role,
      fullName: String(payload.fullName ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null; // expired, tampered, or wrong secret
  }
}