import { describe, expect, it } from "vitest";

import { ROUTE_LENGTH_M } from "./route";
import {
  STATIONS,
  STATION_COUNT,
  getStationById,
  isStationId,
  FINISH_POSITION_X,
} from "./stations";
import { LOCO_2_UPGRADE_ID } from "./upgrades";

describe("station data integrity", () => {
  it("has exactly 7 stations", () => {
    expect(STATION_COUNT).toBe(7);
    expect(STATIONS.length).toBe(7);
  });

  it("has unique station ids", () => {
    const ids = STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("positions all stations within the route bounds", () => {
    for (const station of STATIONS) {
      expect(station.positionX).toBeGreaterThanOrEqual(0);
      expect(station.positionX).toBeLessThanOrEqual(ROUTE_LENGTH_M);
    }
  });

  it("stations are sorted by ascending position", () => {
    for (let i = 1; i < STATIONS.length; i += 1) {
      expect(STATIONS[i].positionX).toBeGreaterThan(STATIONS[i - 1].positionX);
    }
  });

  it("keeps a sane minimum spacing between stations", () => {
    const MIN_SPACING_M = 300;
    for (let i = 1; i < STATIONS.length; i += 1) {
      const gap = STATIONS[i].positionX - STATIONS[i - 1].positionX;
      expect(gap).toBeGreaterThanOrEqual(MIN_SPACING_M);
    }
  });

  it("sells the loco-2 upgrade at exactly one middle-third station", () => {
    const lowerThird = ROUTE_LENGTH_M / 3;
    const upperThird = (2 * ROUTE_LENGTH_M) / 3;
    const sellers = STATIONS.filter((s) =>
      s.services.upgradeIds.includes(LOCO_2_UPGRADE_ID),
    );
    expect(sellers.length).toBe(1);
    const seller = sellers[0];
    expect(seller.positionX).toBeGreaterThanOrEqual(lowerThird);
    expect(seller.positionX).toBeLessThanOrEqual(upperThird);
    expect(seller.services.upgrades).toBe(true);
  });

  it("only lists upgrade ids when upgrades are offered", () => {
    for (const station of STATIONS) {
      if (station.services.upgrades) {
        expect(station.services.upgradeIds.length).toBeGreaterThan(0);
      } else {
        expect(station.services.upgradeIds.length).toBe(0);
      }
    }
  });

  it("resolves stations by id and validates ids", () => {
    expect(getStationById("station-port")?.name).toBe("Cinderport Harbour");
    expect(getStationById("nope")).toBeUndefined();
    expect(isStationId("station-repair-depot")).toBe(true);
    expect(isStationId("nope")).toBe(false);
  });

  it("places the finish at the route end", () => {
    expect(FINISH_POSITION_X).toBe(ROUTE_LENGTH_M);
  });
});
