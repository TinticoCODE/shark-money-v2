import { describe, expect, it } from "vitest";
import { detectSpendingAnomalies } from "@/domain/anomaly-detection";

describe("anomaly-detection", () => {
  it("detecta categorías con gasto anómalo vs promedio previo", () => {
    const anomalies = detectSpendingAnomalies({
      categories: [
        {
          categoryId: "food",
          categoryName: "Comida",
          currentMonthSpent: "450000",
          previousMonthsSpent: ["200000", "210000", "190000"],
        },
        {
          categoryId: "transport",
          categoryName: "Transporte",
          currentMonthSpent: "120000",
          previousMonthsSpent: ["100000", "110000", "90000"],
        },
      ],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.categoryId).toBe("food");
  });

  it("ignora categorías sin historial previo", () => {
    const anomalies = detectSpendingAnomalies({
      categories: [
        {
          categoryId: "new",
          categoryName: "Nueva",
          currentMonthSpent: "500000",
          previousMonthsSpent: [],
        },
      ],
    });

    expect(anomalies).toHaveLength(0);
  });
});
