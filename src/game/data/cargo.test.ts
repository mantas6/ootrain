import { describe, expect, it } from "vitest";

import {
  CARGO_JOBS,
  getCargoJobById,
  getCargoJobTotalWeightKg,
  getCargoDestinationX,
  isValidCargoDestination,
} from "./cargo";
import { FINISH_DESTINATION, getStationById, isStationId } from "./stations";

describe("cargo data integrity", () => {
  it("has unique job ids", () => {
    const ids = CARGO_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("origins reference existing stations", () => {
    for (const job of CARGO_JOBS) {
      expect(isStationId(job.originStationId)).toBe(true);
    }
  });

  it("destinations reference existing stations or 'finish'", () => {
    for (const job of CARGO_JOBS) {
      expect(isValidCargoDestination(job.destinationStationId)).toBe(true);
    }
  });

  it("destination is always forward of the origin", () => {
    for (const job of CARGO_JOBS) {
      const origin = getStationById(job.originStationId);
      expect(origin).toBeDefined();
      const destX = getCargoDestinationX(job);
      expect(destX).toBeDefined();
      // Non-null asserted above via expect(...).toBeDefined().
      expect(destX as number).toBeGreaterThan(
        (origin as { positionX: number }).positionX,
      );
    }
  });

  it("has plausible positive weights, wagon counts, and payments", () => {
    for (const job of CARGO_JOBS) {
      expect(job.wagonCount).toBeGreaterThan(0);
      expect(job.weightPerWagonKg).toBeGreaterThan(0);
      expect(job.payment).toBeGreaterThan(0);
    }
  });

  it("computes total weight from wagon count and per-wagon weight", () => {
    const job = CARGO_JOBS[0];
    expect(getCargoJobTotalWeightKg(job)).toBe(
      job.wagonCount * job.weightPerWagonKg,
    );
  });

  it("pays more for heavier jobs sharing the same origin", () => {
    const byOrigin = new Map<string, (typeof CARGO_JOBS)[number][]>();
    for (const job of CARGO_JOBS) {
      const list = byOrigin.get(job.originStationId) ?? [];
      list.push(job);
      byOrigin.set(job.originStationId, list);
    }
    for (const jobs of byOrigin.values()) {
      const sorted = [...jobs].sort(
        (a, b) => getCargoJobTotalWeightKg(a) - getCargoJobTotalWeightKg(b),
      );
      for (let i = 1; i < sorted.length; i += 1) {
        // Strictly heavier -> strictly higher pay within a shared origin.
        if (
          getCargoJobTotalWeightKg(sorted[i]) >
          getCargoJobTotalWeightKg(sorted[i - 1])
        ) {
          expect(sorted[i].payment).toBeGreaterThan(sorted[i - 1].payment);
        }
      }
    }
  });

  it("offers a spread of light and heavy jobs", () => {
    const weights = CARGO_JOBS.map(getCargoJobTotalWeightKg);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    // Heaviest job should meaningfully outweigh the lightest (tradeoff spread).
    expect(max).toBeGreaterThan(min * 4);
  });

  it("has at least one job delivered to the finish", () => {
    const toFinish = CARGO_JOBS.filter(
      (j) => j.destinationStationId === FINISH_DESTINATION,
    );
    expect(toFinish.length).toBeGreaterThan(0);
  });

  it("resolves jobs by id", () => {
    expect(getCargoJobById("cargo-port-mail")?.name).toBe("Evac Mail Pouches");
    expect(getCargoJobById("nope")).toBeUndefined();
  });
});
