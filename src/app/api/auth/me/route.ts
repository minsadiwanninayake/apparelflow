import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  const headers = { "Cache-Control": "no-store" };

  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401, headers });
  }
  return NextResponse.json({ user }, { headers });
}