import { useState } from "react";
import { listScenarios } from "../app/scenarioRegistry.js";

const TEST_SESSION_STORAGE_KEY = "battle-earth:test-session";
const MAP_CACHE_DB_NAME = "MapGenCache";

function deleteMapCache() {
  if (typeof indexedDB === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(MAP_CACHE_DB_NAME);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
}

export function TestLab({ onLaunchScenario }) {
  const [status, setStatus] = useState(null);
  const scenarios = listScenarios({ testLabOnly: true });
  const buildId = import.meta.env.VITE_BUILD_ID ?? import.meta.env.MODE;

  const resetSession = () => {
    window.localStorage.removeItem(TEST_SESSION_STORAGE_KEY);
    setStatus("Test-session state reset.");
  };

  const clearCache = async () => {
    const cleared = await deleteMapCache();
    setStatus(
      cleared
        ? "Map cache cleared."
        : "Map cache could not be cleared while another map connection is open.",
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-sky-800/70 bg-slate-900/95 p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
            Developer tooling
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Replica Neighborhood Test Lab</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Launch the current vertical slice through the same scenario, routing, and
            BattleSession contracts used by the application. These shortcuts skip menu
            steps, not game logic.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => onLaunchScenario(scenario.id)}
                className="rounded-lg border border-slate-700 bg-slate-800 p-5 text-left transition hover:border-sky-500 hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <span className="block text-base font-semibold text-white">
                  {scenario.label}
                </span>
                <span className="mt-2 block text-sm leading-5 text-slate-300">
                  {scenario.description}
                </span>
                <span className="mt-3 block font-mono text-xs text-slate-500">
                  ?dev=1&amp;scenario={scenario.id}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-7 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <div>
                  Fixture: <span className="text-slate-200">St. Paul / Harriet Island</span>
                </div>
                <div>
                  Data mode: <span className="text-slate-200">deterministic replica fixture</span>
                </div>
                <div>
                  Build: <span className="font-mono text-slate-200">{buildId}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold hover:border-slate-400"
                >
                  Reset test session
                </button>
                <button
                  type="button"
                  onClick={clearCache}
                  className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold hover:border-slate-400"
                >
                  Clear map cache
                </button>
              </div>
            </div>
            {status ? <p className="mt-3 text-xs text-amber-300">{status}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
