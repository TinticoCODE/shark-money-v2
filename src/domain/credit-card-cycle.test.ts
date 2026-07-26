import { describe, expect, it } from "vitest";
import {
  getBillingCycleForDate,
  getCreditCardCycleSnapshot,
} from "@/domain/credit-card-cycle";

const TZ = "America/Bogota";

describe("credit-card-cycle", () => {
  it("asigna compra antes del corte al ciclo del mes actual", () => {
    const cycle = getBillingCycleForDate(new Date("2026-03-10T15:00:00.000Z"), 15, TZ);
    expect(cycle).toEqual({ year: 2026, month: 3 });
  });

  it("asigna compra después del corte al ciclo del mes siguiente", () => {
    const cycle = getBillingCycleForDate(new Date("2026-03-20T15:00:00.000Z"), 15, TZ);
    expect(cycle).toEqual({ year: 2026, month: 4 });
  });

  it("calcula corte reciente cuando el corte del mes aún no llega", () => {
    const snapshot = getCreditCardCycleSnapshot(
      new Date("2026-03-10T12:00:00.000Z"),
      15,
      5,
      TZ,
    );

    expect(snapshot.currentBillingCycle).toEqual({ year: 2026, month: 2 });
    expect(snapshot.recentCutoffDate.getDate()).toBe(15);
  });

  it("calcula corte reciente cuando el corte del mes ya pasó", () => {
    const snapshot = getCreditCardCycleSnapshot(
      new Date("2026-03-20T12:00:00.000Z"),
      15,
      5,
      TZ,
    );

    expect(snapshot.currentBillingCycle).toEqual({ year: 2026, month: 3 });
    expect(snapshot.nextCutoffDate.getMonth()).toBe(3);
  });
});
