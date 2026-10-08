import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/session";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? ROLE_HOME[user.role] : "/login");
}