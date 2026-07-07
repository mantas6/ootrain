# Failure / pressure systems

## Timer

The main pressure is the countdown timer. The player must finish before time reaches zero.

## Overheating / temperature limit

Temperature is a core limiting factor on how much power the player can demand from the engine.

Engine temperature rises from:

- High throttle / sustained engine power
- Climbing uphill
- Pulling heavy cargo / many parts or wagons
- Low speed under heavy load, where the engine works hard but airflow/cooling is poor
- Existing engine damage or poor repair state

Temperature should have clear threshold states:

| State    | Meaning                     | Gameplay result                                                             |
| -------- | --------------------------- | --------------------------------------------------------------------------- |
| Safe     | Normal operating range      | Full control, no penalty                                                    |
| Warning  | Hot but still usable        | UI warning, alarms, player can continue if careful                          |
| Critical | Near maximum                | Power may drop, damage/wear increases quickly, smoke/heat effects intensify |
| Failure  | Exceeds maximum temperature | Engine breaks / run fails unless a recovery mechanic is later added         |

If the player keeps pushing past the warning threshold, the locomotive can reach maximum temperature and effectively fail. The warning state should be readable enough that failure feels like the player's risk decision, not a surprise.

Cooling/recovery options:

- Reduce throttle
- Brake or stop briefly
- Crest the hill and reduce load demand
- Repair/upgrade cooling at stations
- Potential upgrades: better radiator, stronger cooling fan, heat-resistant engine parts

## Traction / wheel slip

Traction is another core limiter on how much cargo the train can haul, especially uphill.

When climbing, the train naturally slows down. If the player demands too much power for the available grip, the wheels can begin to slip instead of transferring power into forward movement.

Wheel slip should be affected by:

- Hill grade / steepness
- Cargo weight and wagon count
- Throttle level / engine torque
- Train speed
- Weather or track condition, if added later
- Locomotive type/upgrades

Gameplay effects:

- Acceleration drops or stops even though the engine is working hard
- Wheels visibly spin faster than the train is moving
- Sparks / screeching / smoke appear near the wheels
- Temperature can rise because power is being wasted
- Wheel/drive damage increases if the player keeps slipping
- Heavy slip can make the train stall on a hill

The player should be able to manage traction by:

- Reducing throttle briefly
- Building speed before a hill
- Choosing lighter cargo
- Upgrading to the stronger locomotive
- Possible future upgrade: sanders / better traction system

## Wear / damage

Damage can come from:

- Overheating
- Wheel slip / traction abuse
- Harsh braking
- Overloading cargo
- Running the engine too hard for too long

Repairs can happen at stations.
