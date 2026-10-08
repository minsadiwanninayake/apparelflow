import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole("cutting_supervisor", "cutting_verifier");
  if (error) return error;

  const recipes = await getRecipes();
  return NextResponse.json({ recipes });
}