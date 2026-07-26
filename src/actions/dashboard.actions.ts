"use server";

import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as dashboardService from "@/services/dashboard.service";

export async function getDashboardSummaryAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof dashboardService.getDashboardSummary>>>
> {
  return runAction(async () => {
    await requireAuthSession();
    return dashboardService.getDashboardSummary();
  });
}
