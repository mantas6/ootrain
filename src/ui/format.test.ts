/**
 * Unit tests for the pure UI formatting / math helpers.
 *
 * These are the only UI tests (per the brief: no DOM component tests). They
 * guard the small pure functions the HUD/strip depend on.
 */

import { describe, expect, it } from "vitest";
import {
  clamp,
  clamp01,
  formatMoney,
  formatSpeedKmh,
  formatTime,
  formatTonnes,
  fractionToPercent,
  positionToStripFraction,
} from "./format";

describe("formatTime", () => {
  it("formats mm:ss with zero-padded seconds", () => {
    expect(formatTime(83)).toBe("1:23");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(600)).toBe("10:00");
  });

  it("clamps negatives to zero", () => {
    expect(formatTime(-5)).toBe("0:00");
  });

  it("floors fractional seconds", () => {
    expect(formatTime(59.9)).toBe("0:59");
  });
});

describe("formatSpeedKmh", () => {
  it("converts m/s to rounded km/h using the magnitude", () => {
    expect(formatSpeedKmh(10)).toBe("36");
    expect(formatSpeedKmh(-10)).toBe("36");
    expect(formatSpeedKmh(0)).toBe("0");
  });
});

describe("formatTonnes", () => {
  it("formats kilograms as one-decimal tonnes", () => {
    expect(formatTonnes(90_000)).toBe("90.0");
    expect(formatTonnes(12_500)).toBe("12.5");
  });
});

describe("formatMoney", () => {
  it("adds a dollar sign and thousands separators", () => {
    expect(formatMoney(3000)).toBe("$3,000");
    expect(formatMoney(999)).toBe("$999");
  });

  it("rounds fractional amounts", () => {
    expect(formatMoney(1234.6)).toBe("$1,235");
  });
});

describe("clamp / clamp01", () => {
  it("clamps to bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("clamp01 clamps to 0..1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe("positionToStripFraction", () => {
  it("maps position to a 0..1 fraction of the route", () => {
    expect(positionToStripFraction(0, 1000)).toBe(0);
    expect(positionToStripFraction(500, 1000)).toBe(0.5);
    expect(positionToStripFraction(1000, 1000)).toBe(1);
  });

  it("clamps out-of-range positions", () => {
    expect(positionToStripFraction(-200, 1000)).toBe(0);
    expect(positionToStripFraction(2000, 1000)).toBe(1);
  });

  it("returns 0 for a zero-length route", () => {
    expect(positionToStripFraction(500, 0)).toBe(0);
  });
});

describe("fractionToPercent", () => {
  it("formats a fraction as a clamped CSS percentage", () => {
    expect(fractionToPercent(0.25)).toBe("25%");
    expect(fractionToPercent(1.5)).toBe("100%");
    expect(fractionToPercent(-1)).toBe("0%");
  });
});
