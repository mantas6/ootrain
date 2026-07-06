import { describe, expect, it } from "vitest";

import {
  UPGRADES,
  LOCO_2_UPGRADE_ID,
  getUpgradeById,
  isUpgradeId,
} from "./upgrades";
import { LOCO_2 } from "./locomotives";

describe("upgrade data integrity", () => {
  it("has unique upgrade ids", () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has positive prices for all upgrades", () => {
    for (const upgrade of UPGRADES) {
      expect(upgrade.price).toBeGreaterThan(0);
    }
  });

  it("includes the loco-2 purchase upgrade", () => {
    const loco2Upgrade = getUpgradeById(LOCO_2_UPGRADE_ID);
    expect(loco2Upgrade).toBeDefined();
    expect(loco2Upgrade?.effects.unlockLocomotiveId).toBe(LOCO_2.id);
    // Price stays in sync with the locomotive definition.
    expect(loco2Upgrade?.price).toBe(LOCO_2.price);
  });

  it("resolves upgrades by id and validates ids", () => {
    expect(getUpgradeById("upgrade-radiator")?.name).toBe(
      "High-Capacity Radiator",
    );
    expect(getUpgradeById("nope")).toBeUndefined();
    expect(isUpgradeId("upgrade-brakes")).toBe(true);
    expect(isUpgradeId("nope")).toBe(false);
  });

  it("declares at least one effect field per upgrade", () => {
    for (const upgrade of UPGRADES) {
      expect(Object.keys(upgrade.effects).length).toBeGreaterThan(0);
    }
  });

  it("covers the required upgrade categories from the design", () => {
    const ids = new Set(UPGRADES.map((u) => u.id));
    // radiator / cooling fan, heat-resistant parts, sanders, brakes, loco-2.
    expect(ids.has("upgrade-radiator")).toBe(true);
    expect(ids.has("upgrade-cooling-fan")).toBe(true);
    expect(ids.has("upgrade-heat-resistant")).toBe(true);
    expect(ids.has("upgrade-sanders")).toBe(true);
    expect(ids.has("upgrade-brakes")).toBe(true);
    expect(ids.has("upgrade-loco-2")).toBe(true);
  });
});
