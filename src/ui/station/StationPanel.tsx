/**
 * StationPanel — the interaction hub shown when the train is stopped in a
 * station's range.
 *
 * Sections: cargo (jobs offered here + carried cargo with detach), repair,
 * refuel, and upgrades. It reads the *available* interactions and costs from
 * the snapshot's `station.interactions`, and enriches them with static details
 * (material, weight, destination, price) from the shared `game/data` modules,
 * keyed by ids the snapshot exposes. Buttons dispatch the matching TrainAction
 * and disable when unaffordable or not applicable. The panel owns no rules.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import type {
  ActiveCargo,
  AvailableInteraction,
  GameSnapshot,
} from "../../game/simulation/types";
import {
  FINISH_DESTINATION,
  getCargoJobById,
  getStationById,
  getUpgradeById,
} from "../../game/data";
import { Panel } from "../components/Panel";
import { ActionButton } from "../components/ActionButton";
import { formatMoney, formatTonnes } from "../format";
import { useGame } from "../useGame";

/** Resolves a destination id to a readable label. */
function destinationLabel(destId: string): string {
  if (destId === FINISH_DESTINATION) return "Summit (finish)";
  return getStationById(destId)?.name ?? destId;
}

/** One offered cargo job row (pickup). */
function CargoJobRow({
  interaction,
  affordable,
  onAccept,
}: {
  interaction: AvailableInteraction;
  affordable: boolean;
  onAccept: (jobId: string) => void;
}): ReactNode {
  const job =
    interaction.id !== undefined ? getCargoJobById(interaction.id) : undefined;
  if (!job) return null;
  const weightKg = job.wagonCount * job.weightPerWagonKg;
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-neutral-700/60 bg-neutral-800/40 px-2 py-1.5">
      <div className="min-w-0">
        <div className="truncate font-mono text-[11px] font-bold text-neutral-100">
          {job.name}
        </div>
        <div className="truncate font-mono text-[9px] text-neutral-400">
          {job.material} · {job.wagonCount}w · {formatTonnes(weightKg)}t →{" "}
          {destinationLabel(job.destinationStationId)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-[11px] font-bold text-emerald-300">
          +{formatMoney(job.payment)}
        </span>
        <ActionButton
          label="Accept"
          tone="accept"
          disabled={!affordable}
          onClick={() => onAccept(job.id)}
        />
      </div>
    </div>
  );
}

/** One carried-cargo row (detach). */
function CarriedCargoRow({
  cargo,
  onDetach,
}: {
  cargo: ActiveCargo;
  onDetach: (jobId: string) => void;
}): ReactNode {
  const job = getCargoJobById(cargo.jobId);
  const name = job?.name ?? cargo.jobId;
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-sky-800/40 bg-sky-950/30 px-2 py-1.5">
      <div className="min-w-0">
        <div className="truncate font-mono text-[11px] font-bold text-sky-200">
          {name}
        </div>
        <div className="truncate font-mono text-[9px] text-neutral-400">
          {cargo.wagonCount}w · {formatTonnes(cargo.totalWeightKg)}t →{" "}
          {destinationLabel(cargo.destinationStationId)} · +
          {formatMoney(cargo.payment)}
        </div>
      </div>
      <ActionButton
        label="Detach"
        tone="danger"
        onClick={() => onDetach(cargo.jobId)}
      />
    </div>
  );
}

interface StationPanelProps {
  snapshot: GameSnapshot;
}

/** Full station interaction panel; renders only when stopped in range. */
export function StationPanel({ snapshot }: StationPanelProps): ReactNode {
  const { applyAction } = useGame();
  const station = snapshot.station;

  const interactions = station.interactions;

  const pickups = useMemo(
    () => interactions.filter((it) => it.kind === "pickup-cargo"),
    [interactions],
  );
  const repair = interactions.find((it) => it.kind === "repair");
  const refuel = interactions.find((it) => it.kind === "refuel");
  const upgrades = useMemo(
    () => interactions.filter((it) => it.kind === "buy-upgrade"),
    [interactions],
  );

  if (!station.inRange || station.stationId === null) return null;

  const money = snapshot.money;
  const stationData = getStationById(station.stationId);

  return (
    <Panel
      interactive
      className="pointer-events-auto max-h-[70vh] w-80 overflow-y-auto"
      title={station.stationName ?? "Station"}
    >
      {stationData !== undefined && (
        <p className="mb-2 font-mono text-[9px] tracking-wide text-neutral-500 uppercase">
          {stationData.region}
        </p>
      )}

      {/* Cargo section */}
      <section className="mb-3">
        <h3 className="mb-1 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
          Cargo Jobs
        </h3>
        {pickups.length === 0 ? (
          <p className="font-mono text-[10px] text-neutral-500">
            No jobs offered here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pickups.map((it) => (
              <CargoJobRow
                key={it.id}
                interaction={it}
                affordable
                onAccept={(jobId) => applyAction({ acceptCargoId: jobId })}
              />
            ))}
          </div>
        )}

        {snapshot.cargo.length > 0 && (
          <>
            <h3 className="mt-2 mb-1 font-mono text-[10px] font-semibold tracking-widest text-sky-400/90 uppercase">
              Carried (auto-delivers)
            </h3>
            <div className="flex flex-col gap-1.5">
              {snapshot.cargo.map((c) => (
                <CarriedCargoRow
                  key={c.jobId}
                  cargo={c}
                  onDetach={(jobId) => applyAction({ detachCargoId: jobId })}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Repair section */}
      <section className="mb-3">
        <h3 className="mb-1 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
          Repair
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-neutral-400">
            Damage{" "}
            {Math.round(Math.max(snapshot.damage, snapshot.wheelDamage) * 100)}%
          </span>
          {repair !== undefined ? (
            <ActionButton
              label={`Repair · ${formatMoney(repair.cost ?? 0)}`}
              tone="spend"
              disabled={money < (repair.cost ?? 0)}
              onClick={() => applyAction({ repair: true })}
            />
          ) : (
            <span className="font-mono text-[10px] text-neutral-600">
              {stationData?.services.repair === true
                ? "No damage"
                : "Unavailable"}
            </span>
          )}
        </div>
      </section>

      {/* Refuel section */}
      <section className="mb-3">
        <h3 className="mb-1 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
          Refuel
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-neutral-400">
            Fuel {Math.round(snapshot.fuelLitres)} /{" "}
            {Math.round(snapshot.fuelCapacity)} L
          </span>
          {refuel !== undefined ? (
            <ActionButton
              label={`Refuel · ${formatMoney(refuel.cost ?? 0)}`}
              tone="spend"
              disabled={money < (refuel.cost ?? 0)}
              onClick={() => applyAction({ refuel: true })}
            />
          ) : (
            <span className="font-mono text-[10px] text-neutral-600">
              {stationData?.services.refuel === true
                ? "Full tank"
                : "Unavailable"}
            </span>
          )}
        </div>
      </section>

      {/* Upgrades section */}
      {stationData?.services.upgrades === true && (
        <section>
          <h3 className="mb-1 font-mono text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase">
            Upgrades
          </h3>
          <div className="flex flex-col gap-1.5">
            {stationData.services.upgradeIds.map((upId) => {
              const up = getUpgradeById(upId);
              if (!up) return null;
              const owned = snapshot.ownedUpgradeIds.includes(upId);
              const offered = upgrades.find((it) => it.id === upId);
              const affordable = money >= up.price;
              return (
                <div
                  key={upId}
                  className="flex items-center justify-between gap-2 rounded border border-neutral-700/60 bg-neutral-800/40 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] font-bold text-neutral-100">
                      {up.name}
                    </div>
                    <div className="font-mono text-[9px] text-neutral-400">
                      {formatMoney(up.price)}
                    </div>
                  </div>
                  {owned ? (
                    <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-emerald-400 uppercase">
                      Owned
                    </span>
                  ) : (
                    <ActionButton
                      label="Buy"
                      tone="spend"
                      disabled={!affordable || offered === undefined}
                      onClick={() => applyAction({ buyUpgradeId: upId })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Panel>
  );
}
