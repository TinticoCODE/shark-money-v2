import { z } from "zod";
import { actionError, actionSuccess, type ActionResult } from "@/types/action-result";

export async function runAction<T>(
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return actionSuccess(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return actionError(error.issues[0]?.message ?? "Datos inválidos");
    }

    const message =
      error instanceof Error ? error.message : "Ocurrió un error inesperado";
    return actionError(message);
  }
}

export async function requireAuthSession() {
  const { getSession } = await import("@/lib/auth/get-session");
  const session = await getSession();

  if (!session) {
    throw new Error("No autenticado");
  }

  return session;
}
