"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actionError,
  actionSuccess,
  type ActionResult,
} from "@/types/action-result";
import {
  createSessionToken,
  getAdminCredentials,
  getSessionCookieName,
  getSessionMaxAgeSeconds,
} from "@/lib/auth/session";

const loginSchema = z.object({
  username: z.string().min(1, "El usuario es obligatorio"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export async function loginAction(
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  try {
    const admin = getAdminCredentials();

    if (
      parsed.data.username !== admin.username ||
      parsed.data.password !== admin.password
    ) {
      return actionError("Usuario o contraseña incorrectos");
    }

    const token = await createSessionToken(parsed.data.username);
    const cookieStore = await cookies();

    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSessionMaxAgeSeconds(),
    });

    return actionSuccess({ redirectTo: "/dashboard" });
  } catch {
    return actionError("No se pudo iniciar sesión. Revisa la configuración.");
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
  redirect("/login");
}
