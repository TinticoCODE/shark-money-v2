import { describe, expect, it } from "vitest";
import { calculateGoalProjection } from "@/domain/goal-projection";

describe("goal-projection", () => {
  const timezone = "America/Bogota";

  it("proyecta fecha estimada con aportes recientes", () => {
    const result = calculateGoalProjection({
      targetAmount: "1000000",
      currentAmount: "700000",
      targetDate: null,
      asOf: new Date("2026-07-01T12:00:00.000Z"),
      timezone,
      contributions: [
        { amount: "100000", contributedAt: new Date("2026-05-10T12:00:00.000Z") },
        { amount: "100000", contributedAt: new Date("2026-06-10T12:00:00.000Z") },
      ],
    });

    expect(result.averageMonthlyContribution.toString()).toBe("100000");
    expect(result.estimatedCompletionDate?.getMonth()).toBe(9);
  });

  it("marca retraso y calcula aporte mensual requerido", () => {
    const result = calculateGoalProjection({
      targetAmount: "1000000",
      currentAmount: "200000",
      targetDate: new Date("2026-09-01T12:00:00.000Z"),
      asOf: new Date("2026-07-01T12:00:00.000Z"),
      timezone,
      contributions: [
        { amount: "50000", contributedAt: new Date("2026-06-10T12:00:00.000Z") },
      ],
    });

    expect(result.isBehindSchedule).toBe(true);
    expect(result.requiredMonthlyContribution?.toString()).toBe("400000");
  });

  it("no proyecta fecha cuando no hay aportes", () => {
    const result = calculateGoalProjection({
      targetAmount: "500000",
      currentAmount: "0",
      targetDate: null,
      asOf: new Date("2026-07-01T12:00:00.000Z"),
      timezone,
      contributions: [],
    });

    expect(result.averageMonthlyContribution.toString()).toBe("0");
    expect(result.estimatedCompletionDate).toBeNull();
  });
});
