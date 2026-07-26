import { prisma } from "@/lib/prisma";

export async function getUserSettingsOrThrow() {
  const settings = await prisma.userSettings.findFirst();

  if (!settings) {
    throw new Error(
      "No hay configuración inicial. Ejecuta npm run db:seed antes de continuar.",
    );
  }

  return settings;
}

export async function getSettings() {
  const settings = await getUserSettingsOrThrow();
  return {
    id: settings.id,
    timezone: settings.timezone,
    currency: settings.currency,
  };
}

export async function updateSettings(input: {
  timezone?: string;
  currency?: string;
}) {
  const settings = await getUserSettingsOrThrow();

  const updated = await prisma.userSettings.update({
    where: { id: settings.id },
    data: {
      timezone: input.timezone,
      currency: input.currency,
    },
  });

  return {
    id: updated.id,
    timezone: updated.timezone,
    currency: updated.currency,
  };
}
