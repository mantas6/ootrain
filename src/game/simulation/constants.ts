/**
 * Central balance / tuning constants for the simulation core.
 *
 * All game-feel knobs live here so systems stay tunable in one place (per the
 * task brief). Units are documented per constant. These values are chosen to
 * hit the balance sanity target from the brief: with loco-1 and no cargo the
 * train climbs the early/mid grades but struggles or slips on the late 7%
 * climb, while loco-2 handles it.
 */

// --- Physics -------------------------------------------------------------

/** Gravitational acceleration, m/s². */
export const GRAVITY = 9.81;

/**
 * Rolling-resistance coefficient (dimensionless). Steel-on-steel rail is very
 * low; this is force per unit weight (N per N). Rolling resistance ≈
 * ROLLING_RESISTANCE_COEFF * mass * g.
 */
export const ROLLING_RESISTANCE_COEFF = 0.002;

/**
 * Lumped aerodynamic drag coefficient, N per (m/s)². Aero drag ≈
 * AERO_DRAG_COEFF * speed². Kept modest since a train's frontal area matters
 * mostly at higher speed.
 */
export const AERO_DRAG_COEFF = 6.5;

/**
 * Speed (m/s) below which tractive effort is limited by the flat
 * `maxTractiveEffortN` cap rather than by power. Above this the effort tapers
 * as power / speed. Prevents a divide-by-zero and models the constant-effort
 * region at low speed.
 */
export const TRACTIVE_EFFORT_BASE_SPEED = 3.0;

/**
 * Maximum brake force available from the base brake system, newtons. Upgrades
 * add to this via `brakeForceBonus`.
 */
export const BASE_BRAKE_FORCE_N = 180_000;

/**
 * Small speed (m/s) treated as "stopped" for station interactions and to snap
 * a coasting/braking train to a halt instead of jittering around zero.
 */
export const STOP_EPSILON = 0.15;

// --- Temperature ---------------------------------------------------------

/** Ambient temperature the engine cools toward, °C. */
export const AMBIENT_TEMP_C = 20;

/** Starting engine temperature at run start, °C. */
export const START_TEMP_C = 40;

/** Warning threshold, °C — UI alarm, still usable. */
export const TEMP_WARNING_C = 105;

/** Critical threshold, °C — power drops, wear accelerates. */
export const TEMP_CRITICAL_C = 120;

/** Failure threshold, °C — engine breaks, run fails. */
export const TEMP_FAILURE_C = 135;

/**
 * Reference over-temperature (°C above ambient) at which a locomotive sheds
 * heat at exactly its `coolingRate`. Cooling scales linearly with the actual
 * over-temperature relative to this reference.
 */
export const COOLING_REFERENCE_DELTA_C = 100;

/**
 * Fraction of the base cooling that is always available even at a standstill
 * (radiator/fan convection). The remainder scales with airflow (speed).
 */
export const COOLING_IDLE_FRACTION = 0.35;

/**
 * Speed (m/s) at which airflow-assisted cooling reaches its full contribution.
 * Below this, poor airflow means the engine sheds heat less effectively — the
 * "low speed under heavy load" penalty from docs/03-pressure-systems.md.
 */
export const COOLING_FULL_AIRFLOW_SPEED = 12;

/**
 * Power fraction available while in the critical temperature band
 * (dimensionless). Critical overheating throttles the engine back as a cue, but
 * not so far that failure becomes impossible: under sustained heavy load the
 * engine still generates net heat and can climb to the failure threshold if the
 * player ignores the warning.
 */
export const CRITICAL_POWER_FACTOR = 0.78;

// --- Traction ------------------------------------------------------------

/**
 * Base rail adhesion coefficient (dimensionless). Tuned deliberately below the
 * starter loco's tractive-effort limit so that at low speed under heavy load
 * loco-1 demands more effort than the rail can transfer and the wheels slip;
 * loco-2 (climbing at higher speed, power-limited) and sanders keep grip ahead
 * of demand. Available grip ≈ (BASE + upgrades) * weightOnDrivers.
 */
export const BASE_ADHESION_COEFF = 0.26;

/**
 * Fraction of total train weight that bears on the driven axles. A locomotive
 * only puts its own weight on the drivers, but this abstracts a share; higher
 * values = more grip. Applied to loco mass only (wagons are unpowered).
 */
export const WEIGHT_ON_DRIVERS_FRACTION = 1.0;

/**
 * Slip ratio (demanded / available effort beyond 1.0) above which the wheels
 * are considered actively slipping for state reporting.
 */
export const SLIP_ONSET_RATIO = 1.0;

/**
 * When slipping, the fraction of demanded-but-ungripped effort that is simply
 * lost (converted to heat/spin instead of forward force). Effective tractive
 * effort is capped at available grip; the excess power becomes waste heat.
 */
export const SLIP_WASTE_HEAT_FACTOR = 0.0006; // °C per (kW·s) of wasted power

/** Wheel damage accrued per second of active slip, damage units (0..1 scale). */
export const SLIP_WHEEL_DAMAGE_RATE = 0.02;

// --- Fire front ----------------------------------------------------------

/** Base speed of the advancing fire front, m/s. */
export const FIRE_BASE_SPEED = 15.5;

/**
 * Mild ramp added to fire speed per second elapsed, m/s². The fire slowly
 * accelerates so lingering late is punished harder than lingering early.
 */
export const FIRE_RAMP_ACCEL = 0.0025;

/** Fire front starting position behind the train, metres (negative = behind start). */
export const FIRE_START_X = -600;

/**
 * Distance (metres) between fire front and train at/under which the train is
 * caught and the run fails.
 */
export const FIRE_CATCH_DISTANCE = 0;

// --- Wear / damage -------------------------------------------------------

/** Damage per second while temperature is in the critical band, damage units. */
export const OVERHEAT_DAMAGE_RATE = 0.03;

/**
 * Damage per second of harsh braking at full brake above a speed threshold,
 * damage units. Scales with brake input and speed.
 */
export const HARSH_BRAKE_DAMAGE_RATE = 0.015;

/** Speed (m/s) above which heavy braking counts as "harsh" for wear. */
export const HARSH_BRAKE_SPEED_THRESHOLD = 8;

/**
 * Total train mass (kg) above which the load is "overloaded" for the current
 * locomotive, accruing slow damage. Expressed as a multiple of loco mass.
 */
export const OVERLOAD_MASS_MULTIPLE = 4.0;

/** Damage per second while overloaded, damage units. */
export const OVERLOAD_DAMAGE_RATE = 0.004;

/**
 * How strongly damage worsens heat generation. Effective heat factor is
 * multiplied by (1 + DAMAGE_HEAT_PENALTY * damage). Full damage (1.0) means
 * this-much extra heat.
 */
export const DAMAGE_HEAT_PENALTY = 0.6;

/**
 * How strongly damage caps power. Effective max power is multiplied by
 * (1 - DAMAGE_POWER_PENALTY * damage). Full damage removes this fraction.
 */
export const DAMAGE_POWER_PENALTY = 0.45;

/** Maximum damage value (fully broken but not necessarily failed). */
export const MAX_DAMAGE = 1.0;

// --- Fuel ----------------------------------------------------------------
//
// Balance target (task brief): fuel must actually matter — under normal driving
// the player refuels roughly every other station (~2 station gaps), sooner with
// aggressive throttle. Previously fuel was effectively unlimited: a whole ~13 km
// run burned only ~30 L of a 2500 L tank (fuelBurnRate was 0.00006 L/(kW·s)).
//
// Fuel burn ≈ enginePowerKW * loco.fuelBurnRate * dt + idle (see fuel.ts), so
// tank life is governed by engine WORK (kW·s), not time. Refuelling requires
// STOPPING at a station, so the sizing case is "cross the longest no-refuel
// stretch starting from a standstill at full throttle" (measured with the sim;
// full throttle is the fuel-optimal way up a hill — less time on the grade =
// less fuel). Measured work from a standstill, loco-1 full throttle:
//
//   stretch                                     distance   work (kW·s)
//   ------------------------------------------- ---------- -----------
//   start → lower-town                            2600 m    ~103,600
//   cargo-yard → repair-depot (ash = NO refuel)   3900 m    ~151,800  ← binds loco-1
//   bridge → summit  (the FINALE, no refuel)      4500 m    ~247,100
//
// loco-1 (2500 L @ 0.013 = 192,300 kW·s per tank):
//   • Longest early no-refuel gap is cargo-yard→repair-depot (ash-tunnel offers
//     no refuel): ~151,800 kW·s ≈ 1973 L ≈ 79% of a tank — crossable with ~21%
//     headroom. This is what caps the burn rate: pushing it higher would strand
//     the player between cargo-yard and the repair depot.
//   • Under continuous driving a full tank lasts ~2–3 station gaps, and each
//     station stop (a restart from rest) costs extra, so the practical cadence
//     is "refuel roughly every other station", sooner when flooring it.
//   • The FINALE (~247,100 kW·s ≈ 3213 L) EXCEEDS loco-1's tank on purpose: the
//     starter cannot make the summit climb on one tank, so the run requires the
//     loco-2 upgrade (sold before the climb, at the repair depot) — reinforcing
//     the design intent that "loco-2 handles the late climb".
//
// loco-2 (6000 L @ 0.014 = 428,600 kW·s per tank): a bigger, more powerful
// engine does much more work over the same ground (full-throttle finale from
// the bridge ≈ 320,400 kW·s ≈ 4485 L; from the repair depot, skipping the bridge
// top-up, ≈ 352,200 kW·s ≈ 4931 L), so it needs both a higher burn rate (still
// "thirstier per unit work") and a larger tank to clear the finale with ~20–25%
// headroom whether it tops up at the bridge or not.
//
// Refuel economy is retuned alongside consumption — see REFUEL_COST_PER_L below.

/** Idle fuel burn even at zero throttle, litres/second (auxiliaries). */
export const IDLE_FUEL_BURN_L_PER_S = 0.05;

/**
 * Fraction of throttle-commanded engine power the engine still draws (as a
 * floor) when straining at low speed, even though little becomes forward
 * motion. This is what makes "low speed under heavy load" run hot per docs/03-pressure-systems.md.
 */
export const ENGINE_LOW_SPEED_STRAIN_FRACTION = 0.7;

// --- Engine RPM ----------------------------------------------------------

/**
 * Engine crankshaft speed at idle (throttle 0), revolutions per minute (RPM).
 * The engine never drops below this while running.
 */
export const ENGINE_IDLE_RPM = 600;

/**
 * Engine crankshaft speed at full throttle, revolutions per minute (RPM).
 * Target RPM interpolates linearly between idle and this with throttle.
 */
export const ENGINE_MAX_RPM = 2_200;

/**
 * First-order spool rate of the engine RPM toward its throttle target, 1/s.
 * RPM approaches the target as `1 - exp(-rate * dt)`, giving a time constant of
 * ~1/rate seconds. Higher = snappier throttle response; lower = more lag. Tuned
 * so the engine audibly spools without feeling sluggish (~0.4 s time constant).
 */
export const ENGINE_RPM_RESPONSE_RATE = 2.5;

// --- Economy -------------------------------------------------------------

/**
 * Money cost per litre of fuel added at a station.
 *
 * Now that fuel is actually consumed (see the "Fuel" block above), refills add
 * real litres, so the per-litre price is lowered from the old 0.4 to keep a
 * fill sensible against the new consumption: a full loco-1 tank (2500 L) costs
 * ~375, a full loco-2 tank (6000 L) ~900 — affordable several times over a run
 * without dominating the economy. (Starting money is tuned in a separate task.)
 */
export const REFUEL_COST_PER_L = 0.15;

/** Money cost to repair one full unit (0..1) of damage. */
export const REPAIR_COST_PER_DAMAGE = 3_500;

// --- Timer / run ---------------------------------------------------------

/** Total countdown time for the run, seconds (13-minute pressure window). */
export const RUN_TIME_LIMIT_S = 780;

/**
 * Distance (metres) within which a station is considered "in range" for
 * interactions when the train is stopped.
 */
export const STATION_RANGE_M = 60;

/** Default deterministic seed when none is supplied. */
export const DEFAULT_SEED = 1;
