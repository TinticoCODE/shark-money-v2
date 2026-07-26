import { cookies } from "next/headers";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth/session";

export async function getSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession(): Promise<{ username: string }> {
  const session = await getSession();

  if (!session) {
    throw new Error("No autenticado");
  }

  return session;
}
