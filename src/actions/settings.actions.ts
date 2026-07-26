"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as settingsService from "@/services/settings.service";

const updateSettingsSchema = z.object({
  timezone: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
});

export async function getSettingsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof settingsService.getSettings>>>
> {
  return runAction(async () => {
    await requireAuthSession();
    return settingsService.getSettings();
  });
}

export async function updateSettingsAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof settingsService.updateSettings>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateSettingsSchema.parse(input);
    return settingsService.updateSettings(parsed);
  });
}
