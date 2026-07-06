/**
 * Placeholder application shell.
 *
 * This mounts an empty full-screen canvas container (the future Three.js world
 * mount point) with a title overlay. No game logic, simulation, rendering, or
 * real UI lives here yet — see TODO.md for the full plan.
 */
export function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-screen canvas container — Three.js will mount here later. */}
      <div
        id="game-canvas"
        className="absolute inset-0 bg-neutral-950"
        aria-hidden="true"
      />

      {/* Placeholder title overlay. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <h1 className="text-4xl font-bold tracking-widest text-neutral-100 uppercase">
          Out of Time Train
        </h1>
      </div>
    </div>
  );
}
