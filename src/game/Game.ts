/**
 * Game simulation core — `createGameSimulation`.
 *
 * Implements the API shape from docs/07-tech.md:
 *   const sim = createGameSimulation(config?);
 *   sim.applyAction({ throttle: 0.7 });
 *   sim.tick(1 / 60);
 *   const snapshot = sim.getSnapshot();
 *
 * The sim owns all game rules and is fully decoupled from rendering / DOM. It
 * composes the per-system pure functions (physics, temperature, traction,
 * fire, wear, fuel) and applies station logic (cargo, repair, refuel,
 * upgrades). Randomness routes through a seeded RNG for determinism.
 *
 * Win / fail rules:
 *   - Win: reach the finish before the timer expires and before the fire.
 *   - Fail: time out, fire catches the train, or engine failure (max temp).
 *   - Running out of fuel is NOT an instant fail — the train coasts and the
 *     fire eventually catches it.
 */

import {
  CARGO_JOBS,
  FINISH_DESTINATION,
  FINISH_POSITION_X,
  getCargoJobById,
  getCargoJobTotalWeightKg,
  getGradeAt,
  getLocomotiveById,
  getUpgradeById,
  LOCO_1,
  ROUTE_LENGTH_M,
  STATIONS,
  UPGRADES,
  type Locomotive,
  type Station,
  type Upgrade,
} from "./data";
import {
  DEFAULT_SEED,
  ENGINE_IDLE_RPM,
  ENGINE_LOW_SPEED_STRAIN_FRACTION,
  RUN_TIME_LIMIT_S,
  START_TEMP_C,
  STARTING_MONEY,
  STATION_RANGE_M,
  STOP_EPSILON,
} from "./simulation/constants";
import { stepEngineRpm } from "./simulation/engineRpm";
import {
  distanceToFire,
  isCaughtByFire,
  stepFire,
} from "./simulation/fireFront";
import {
  burnFuel,
  computeFuelBurn,
  isEmpty,
  refuel as refuelFuel,
} from "./simulation/fuel";
import { createRng, serializeRng, type Rng } from "./simulation/rng";
import {
  classifyTemperature,
  stepTemperature,
  thermalPowerFactor,
} from "./simulation/temperature";
import {
  evaluateTraction,
  slipWasteHeat,
  slipWheelDamage,
} from "./simulation/traction";
import {
  computeBrakeCapacity,
  computeDemandedTractiveEffort,
  stepPhysics,
} from "./simulation/trainPhysics";
import type {
  ActiveCargo,
  AvailableInteraction,
  GameSnapshot,
  SimState,
  StationProximity,
  TrainAction,
} from "./simulation/types";
import {
  applyDamage,
  computeDamageAccrual,
  damagePowerFactor,
  repair as repairWear,
  repairCost,
} from "./simulation/wear";
import { REFUEL_COST_PER_L } from "./simulation/constants";

/** Optional config accepted by {@link createGameSimulation}. */
export interface GameConfig {
  /** Deterministic PRNG seed. */
  seed?: number;
  /** Starting money. */
  startingMoney?: number;
  /** Countdown time limit override, seconds. */
  timeLimitS?: number;
  /** Starting locomotive id (defaults to loco-1). */
  locomotiveId?: string;
}

/** The public simulation handle. */
export interface GameSimulation {
  /** Applies action inputs (persist between ticks until changed). */
  applyAction(action: TrainAction): void;
  /** Advances the sim by `dtSeconds`. */
  tick(dtSeconds: number): void;
  /** Returns a read-only snapshot of the current state. */
  getSnapshot(): GameSnapshot;
  /** Returns the raw mutable state (for save/load). Treat as internal. */
  getState(): SimState;
  /** Replaces the internal state (for load). */
  setState(state: SimState): void;
}

/** Resolved (post-upgrade) locomotive parameters used by the systems. */
interface EffectiveLoco {
  loco: Locomotive;
  maxPowerKW: number;
  maxTractiveEffortN: number;
  fuelCapacity: number;
  fuelBurnRate: number;
  coolingRate: number;
  heatGenerationFactor: number;
  tractionBonus: number;
  brakeForceBonusN: number;
}

/** Creates a fresh, deterministic game simulation. */
export function createGameSimulation(config: GameConfig = {}): GameSimulation {
  const seed = config.seed ?? DEFAULT_SEED;
  const rng: Rng = createRng(seed);
  const locomotiveId = config.locomotiveId ?? LOCO_1.id;

  const state: SimState = {
    physics: { positionX: 0, speed: 0, reverse: false },
    thermal: { tempC: START_TEMP_C },
    traction: { state: "gripping", slipRatio: 0 },
    wear: { damage: 0, wheelDamage: 0 },
    fuel: {
      litres: (getLocomotiveById(locomotiveId) ?? LOCO_1).fuelCapacity,
    },
    engine: { rpm: ENGINE_IDLE_RPM },
    fire: { positionX: -600, elapsedS: 0 },
    locomotiveId,
    ownedUpgradeIds: [],
    cargo: [],
    money: config.startingMoney ?? STARTING_MONEY,
    timeRemainingS: config.timeLimitS ?? RUN_TIME_LIMIT_S,
    input: { throttle: 0, brake: 0 },
    runState: "running",
    runEndReason: "none",
    rng: serializeRng(rng, seed),
  };

  /** Resolves the active locomotive + owned-upgrade effects. */
  function effectiveLoco(): EffectiveLoco {
    const loco = getLocomotiveById(state.locomotiveId) ?? LOCO_1;
    let coolingRate = loco.coolingRate;
    let heatGenerationFactor = loco.heatGenerationFactor;
    let tractionBonus = 0;
    let brakeForceBonusN = 0;

    for (const id of state.ownedUpgradeIds) {
      const up = getUpgradeById(id);
      if (!up) continue;
      const e = up.effects;
      if (e.coolingBonus !== undefined) coolingRate += e.coolingBonus;
      if (e.tractionBonus !== undefined) tractionBonus += e.tractionBonus;
      if (e.brakeForceBonus !== undefined) {
        brakeForceBonusN += e.brakeForceBonus;
      }
      if (e.heatGenerationReduction !== undefined) {
        heatGenerationFactor *= 1 - e.heatGenerationReduction;
      }
    }

    return {
      loco,
      maxPowerKW: loco.maxPowerKW,
      maxTractiveEffortN: loco.maxTractiveEffortN,
      fuelCapacity: loco.fuelCapacity,
      fuelBurnRate: loco.fuelBurnRate,
      coolingRate,
      heatGenerationFactor,
      tractionBonus,
      brakeForceBonusN,
    };
  }

  /** Total train mass (loco + cargo), kg. */
  function totalMassKg(loco: Locomotive): number {
    const cargoMass = state.cargo.reduce((s, c) => s + c.totalWeightKg, 0);
    return loco.mass + cargoMass;
  }

  /** Whether the train is stopped (for station interactions). */
  function isStopped(): boolean {
    return Math.abs(state.physics.speed) < STOP_EPSILON;
  }

  /** Nearest station and its signed distance from the train. */
  function nearestStation(): { station: Station | null; distanceM: number } {
    let best: Station | null = null;
    let bestDist = Infinity;
    for (const st of STATIONS) {
      const d = st.positionX - state.physics.positionX;
      if (Math.abs(d) < Math.abs(bestDist)) {
        bestDist = d;
        best = st;
      }
    }
    return { station: best, distanceM: best ? bestDist : Infinity };
  }

  /** The station currently in interaction range (stopped + close), if any. */
  function stationInRange(): Station | null {
    if (!isStopped()) return null;
    const { station, distanceM } = nearestStation();
    if (station && Math.abs(distanceM) <= STATION_RANGE_M) {
      return station;
    }
    return null;
  }

  // --- Station interaction handlers --------------------------------------

  function tryAcceptCargo(station: Station, jobId: string): void {
    if (!station.services.cargoPickup) return;
    const job = getCargoJobById(jobId);
    if (!job) return;
    if (job.originStationId !== station.id) return;
    if (state.cargo.some((c) => c.jobId === jobId)) return;

    const cargo: ActiveCargo = {
      jobId: job.id,
      wagonCount: job.wagonCount,
      totalWeightKg: getCargoJobTotalWeightKg(job),
      destinationStationId: job.destinationStationId,
      payment: job.payment,
    };
    state.cargo.push(cargo);
  }

  function tryDetachCargo(jobId: string): void {
    const idx = state.cargo.findIndex((c) => c.jobId === jobId);
    if (idx >= 0) {
      state.cargo.splice(idx, 1);
    }
  }

  /** Delivers any cargo whose destination matches the current station. */
  function deliverCargoAt(station: Station): void {
    if (!station.services.cargoDelivery) return;
    const remaining: ActiveCargo[] = [];
    for (const c of state.cargo) {
      if (c.destinationStationId === station.id) {
        state.money += c.payment;
      } else {
        remaining.push(c);
      }
    }
    state.cargo = remaining;
  }

  /** Delivers any finish-destined cargo when reaching the finish. */
  function deliverFinishCargo(): void {
    const remaining: ActiveCargo[] = [];
    for (const c of state.cargo) {
      if (c.destinationStationId === FINISH_DESTINATION) {
        state.money += c.payment;
      } else {
        remaining.push(c);
      }
    }
    state.cargo = remaining;
  }

  function tryRepair(station: Station): void {
    if (!station.services.repair) return;
    const result = repairWear(
      state.wear.damage,
      state.wear.wheelDamage,
      state.money,
    );
    state.wear.damage = result.damage;
    state.wear.wheelDamage = result.wheelDamage;
    state.money = result.money;
  }

  function tryRefuel(station: Station, loco: EffectiveLoco): void {
    if (!station.services.refuel) return;
    const result = refuelFuel(
      state.fuel.litres,
      loco.fuelCapacity,
      state.money,
    );
    state.fuel.litres = result.litres;
    state.money = result.money;
  }

  function tryBuyUpgrade(station: Station, upgradeId: string): void {
    if (!station.services.upgrades) return;
    if (!station.services.upgradeIds.includes(upgradeId)) return;
    if (state.ownedUpgradeIds.includes(upgradeId)) return;
    const up = getUpgradeById(upgradeId);
    if (!up) return;
    if (state.money < up.price) return;

    state.money -= up.price;
    state.ownedUpgradeIds.push(upgradeId);

    // Loco swap upgrade: change the active locomotive stats. Preserve current
    // fuel level but do not exceed the new tank capacity.
    if (up.effects.unlockLocomotiveId !== undefined) {
      const newLoco = getLocomotiveById(up.effects.unlockLocomotiveId);
      if (newLoco) {
        state.locomotiveId = newLoco.id;
        state.fuel.litres = Math.min(state.fuel.litres, newLoco.fuelCapacity);
      }
    }
  }

  // --- Public API --------------------------------------------------------

  function applyAction(action: TrainAction): void {
    if (state.runState !== "running") return;

    if (action.throttle !== undefined) {
      state.input.throttle = clamp01(action.throttle);
    }
    if (action.brake !== undefined) {
      state.input.brake = clamp01(action.brake);
    }
    if (action.reverse !== undefined) {
      state.physics.reverse = action.reverse;
    }

    // Station interactions only when stopped within range.
    const station = stationInRange();
    if (station) {
      const loco = effectiveLoco();
      if (action.interact === true) {
        // Generic interact auto-delivers matching cargo.
        deliverCargoAt(station);
      }
      if (action.acceptCargoId !== undefined) {
        tryAcceptCargo(station, action.acceptCargoId);
      }
      if (action.detachCargoId !== undefined) {
        tryDetachCargo(action.detachCargoId);
      }
      if (action.repair === true) {
        tryRepair(station);
      }
      if (action.refuel === true) {
        tryRefuel(station, loco);
      }
      if (action.buyUpgradeId !== undefined) {
        tryBuyUpgrade(station, action.buyUpgradeId);
      }
      // Delivering to the station is always attempted on interact/accept.
      if (
        action.acceptCargoId !== undefined ||
        action.interact === true ||
        action.detachCargoId !== undefined
      ) {
        deliverCargoAt(station);
      }
    } else {
      // detachCargo is allowed anywhere (shed weight in an emergency).
      if (action.detachCargoId !== undefined) {
        tryDetachCargo(action.detachCargoId);
      }
    }
  }

  function tick(dt: number): void {
    if (state.runState !== "running" || dt <= 0) return;

    const loco = effectiveLoco();
    const mass = totalMassKg(loco.loco);
    const grade = getGradeAt(state.physics.positionX);
    const speedMag = Math.abs(state.physics.speed);

    // --- Available power (thermal + damage + fuel gating) ---
    const tempState = classifyTemperature(state.thermal.tempC);
    const powerFactor =
      thermalPowerFactor(tempState) * damagePowerFactor(state.wear.damage);
    const fuelAvailable = !isEmpty(state.fuel.litres);
    const throttle = fuelAvailable ? state.input.throttle : 0;

    // --- Engine RPM (throttle-driven, first-order spool lag) ---
    // Uses the fuel-gated throttle so a dry tank lets the engine fall to idle.
    state.engine.rpm = stepEngineRpm(state.engine.rpm, throttle, dt);

    const availPowerKW = loco.maxPowerKW * powerFactor;
    const availPowerW = availPowerKW * 1000;

    // --- Demanded tractive effort, limited by power at speed ---
    const demandedEffortN = computeDemandedTractiveEffort(
      throttle,
      state.physics.speed,
      {
        maxPowerW: availPowerW,
        maxTractiveEffortN: loco.maxTractiveEffortN * powerFactor,
      },
    );

    // --- Traction: cap effort at available grip, detect slip ---
    const traction = evaluateTraction({
      locoMassKg: loco.loco.mass,
      tractionBonus: loco.tractionBonus,
      demandedEffortN,
    });
    state.traction.state = traction.state;
    state.traction.slipRatio = traction.slipRatio;

    // --- Physics integration ---
    const brakeCapacity = computeBrakeCapacity(loco.brakeForceBonusN);
    const physicsResult = stepPhysics({
      speed: state.physics.speed,
      positionX: state.physics.positionX,
      reverse: state.physics.reverse,
      massKg: mass,
      grade,
      effectiveTractiveEffortN: traction.effectiveEffortN,
      brake: state.input.brake,
      brakeCapacityN: brakeCapacity,
      dt,
    });
    state.physics.speed = physicsResult.speed;
    state.physics.positionX = physicsResult.positionX;

    // Clamp position to the route (no travelling before the start line).
    if (state.physics.positionX < 0) {
      state.physics.positionX = 0;
      if (state.physics.speed < 0) state.physics.speed = 0;
    }

    // --- Engine power draw (for heat & fuel) ---
    // Mechanical output is effort * surface speed, but a straining engine at
    // low speed under heavy load still draws substantial power (and runs hot)
    // even though little of it becomes forward motion. We therefore floor the
    // engine draw at a fraction of the throttle-commanded engine power. This is
    // the "low speed under heavy load, poor cooling" heat source from docs/03-pressure-systems.md.
    const surfaceSpeed = Math.max(speedMag, 2);
    const mechanicalPowerKW = (traction.effectiveEffortN * surfaceSpeed) / 1000;
    const strainFloorKW =
      throttle * availPowerKW * ENGINE_LOW_SPEED_STRAIN_FRACTION;
    const enginePowerKW = Math.max(mechanicalPowerKW, strainFloorKW);

    // --- Fuel burn ---
    if (fuelAvailable) {
      const burned = computeFuelBurn(enginePowerKW, loco.fuelBurnRate, dt);
      state.fuel.litres = burnFuel(state.fuel.litres, burned);
    }

    // --- Temperature ---
    const slipHeat = slipWasteHeat(traction.wastedEffortN, speedMag, dt);
    const thermalResult = stepTemperature({
      tempC: state.thermal.tempC,
      deliveredPowerKW: enginePowerKW,
      heatGenerationFactor: loco.heatGenerationFactor,
      coolingRate: loco.coolingRate,
      speedMagAbs: speedMag,
      damage: state.wear.damage,
      extraHeatC: slipHeat,
      dt,
    });
    state.thermal.tempC = thermalResult.tempC;

    // --- Wear / damage ---
    const wearAccrual = computeDamageAccrual({
      temperatureState: thermalResult.state,
      brake: state.input.brake,
      speedMagAbs: speedMag,
      totalMassKg: mass,
      locoMassKg: loco.loco.mass,
      dt,
    });
    state.wear.damage = applyDamage(state.wear.damage, wearAccrual);
    state.wear.wheelDamage = applyDamage(
      state.wear.wheelDamage,
      slipWheelDamage(traction.state, dt),
    );

    // --- Fire front ---
    const fireResult = stepFire(state.fire.positionX, state.fire.elapsedS, dt);
    state.fire.positionX = fireResult.positionX;
    state.fire.elapsedS = fireResult.elapsedS;

    // --- Timer ---
    state.timeRemainingS = Math.max(0, state.timeRemainingS - dt);

    // --- Win / fail resolution ---
    // Win: reached finish.
    if (state.physics.positionX >= FINISH_POSITION_X) {
      state.physics.positionX = FINISH_POSITION_X;
      deliverFinishCargo();
      state.runState = "won";
      state.runEndReason = "reached-finish";
      return;
    }
    // Fail: engine failure at max temp.
    if (thermalResult.state === "failure") {
      state.runState = "failed";
      state.runEndReason = "engine-failure";
      return;
    }
    // Fail: fire caught the train.
    if (isCaughtByFire(state.physics.positionX, state.fire.positionX)) {
      state.runState = "failed";
      state.runEndReason = "fire-caught";
      return;
    }
    // Fail: time out.
    if (state.timeRemainingS <= 0) {
      state.runState = "failed";
      state.runEndReason = "time-out";
      return;
    }
  }

  function buildStationProximity(): StationProximity {
    const { station, distanceM } = nearestStation();
    const inRangeStation = stationInRange();
    const interactions: AvailableInteraction[] = [];

    if (inRangeStation) {
      const loco = effectiveLoco();
      const s = inRangeStation.services;

      if (s.cargoPickup) {
        for (const job of CARGO_JOBS) {
          if (
            job.originStationId === inRangeStation.id &&
            !state.cargo.some((c) => c.jobId === job.id)
          ) {
            interactions.push({
              kind: "pickup-cargo",
              id: job.id,
              cost: 0,
              label: `Pick up ${job.name} (+${job.payment})`,
            });
          }
        }
      }
      if (s.cargoDelivery) {
        for (const c of state.cargo) {
          if (c.destinationStationId === inRangeStation.id) {
            interactions.push({
              kind: "deliver-cargo",
              id: c.jobId,
              cost: 0,
              label: `Deliver ${c.jobId} (+${c.payment})`,
            });
          }
        }
      }
      if (s.repair && state.wear.damage + state.wear.wheelDamage > 0) {
        const cost = repairCost(state.wear.damage + state.wear.wheelDamage);
        interactions.push({
          kind: "repair",
          cost,
          label: `Repair (-${cost})`,
        });
      }
      if (s.refuel && state.fuel.litres < loco.fuelCapacity) {
        const cost = Math.ceil(
          (loco.fuelCapacity - state.fuel.litres) * REFUEL_COST_PER_L,
        );
        interactions.push({
          kind: "refuel",
          cost,
          label: `Refuel (-${cost})`,
        });
      }
      if (s.upgrades) {
        for (const id of s.upgradeIds) {
          if (state.ownedUpgradeIds.includes(id)) continue;
          const up: Upgrade | undefined = getUpgradeById(id);
          if (!up) continue;
          interactions.push({
            kind: "buy-upgrade",
            id: up.id,
            cost: up.price,
            label: `${up.name} (-${up.price})`,
          });
        }
      }
    }

    return {
      stationId: station?.id ?? null,
      stationName: station?.name ?? null,
      distanceM: station ? distanceM : Infinity,
      inRange: inRangeStation !== null,
      interactions,
    };
  }

  function getSnapshot(): GameSnapshot {
    const loco = effectiveLoco();
    const grade = getGradeAt(state.physics.positionX);
    return {
      positionX: state.physics.positionX,
      speed: state.physics.speed,
      grade,
      reverse: state.physics.reverse,
      fuelLitres: state.fuel.litres,
      fuelCapacity: loco.fuelCapacity,
      temperatureC: state.thermal.tempC,
      temperatureState: classifyTemperature(state.thermal.tempC),
      engineRpm: state.engine.rpm,
      tractionState: state.traction.state,
      slipRatio: state.traction.slipRatio,
      damage: state.wear.damage,
      wheelDamage: state.wear.wheelDamage,
      totalMassKg: totalMassKg(loco.loco),
      cargo: state.cargo.map((c) => ({ ...c })),
      money: state.money,
      locomotiveId: state.locomotiveId,
      ownedUpgradeIds: [...state.ownedUpgradeIds],
      station: buildStationProximity(),
      fireFrontX: state.fire.positionX,
      fireDistanceM: distanceToFire(
        state.physics.positionX,
        state.fire.positionX,
      ),
      timeRemainingS: state.timeRemainingS,
      runState: state.runState,
      runEndReason: state.runEndReason,
      progress: clamp01(state.physics.positionX / ROUTE_LENGTH_M),
    };
  }

  function getState(): SimState {
    return state;
  }

  function setState(next: SimState): void {
    Object.assign(state, next);
  }

  return { applyAction, tick, getSnapshot, getState, setState };
}

/** Exposes the balance-relevant data ids for consumers. */
export const AVAILABLE_UPGRADE_IDS: readonly string[] = UPGRADES.map(
  (u) => u.id,
);

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
