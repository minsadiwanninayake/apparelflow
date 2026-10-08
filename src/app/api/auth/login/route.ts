import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  ROLE_HOME,
} from "@/lib/session";

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = LoginBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const passwordOk = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;

  // Same message for wrong email and wrong password, so attackers can't guess emails
  if (!user || !passwordOk) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, fullName: user.fullName, role: user.role },
    redirectTo: ROLE_HOME[user.role],
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}