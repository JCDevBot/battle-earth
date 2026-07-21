import { Component, lazy, Suspense, useState } from "react";
import { createPrototypeSmokeLocation } from "./app/prototypeScenario.js";
import {
  SCENARIO_IDS,
  SCENARIO_START_TYPES,
  createScenarioLocation,
  getScenario,
  isTestLabEnabled,
  readScenarioId,
} from "./app/scenarioRegistry.js";
import {
  APP_STAGES,
  canRenderStage,
  getStageForLocation,
  normalizeSelectedLocation,
} from "./app/stageRouting.js";
import { GlobePicker } from "./components/GlobePicker";
import { TestLab } from "./components/TestLab";

const CampaignStage = lazy(() =>
  import("./components/CampaignStage").then((module) => ({
    default: module.CampaignStage,
  })),
);
const TacticalStage = lazy(() =>
  import("./components/TacticalStage").then((module) => ({
    default: module.TacticalStage,
  })),
);

function runtimeSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function updateScenarioQuery(scenarioId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (scenarioId) url.searchParams.set("scenario", scenarioId);
  else url.searchParams.delete("scenario");
  url.searchParams.set("dev", "1");
  window.history.replaceState({}, "", url);
}

function createGlobeSmokeLocation(selectedLocation) {
  const normalizedLocation = normalizeSelectedLocation(selectedLocation);
  if (!normalizedLocation) return null;

  const smokeLocation = createPrototypeSmokeLocation();
  return normalizeSelectedLocation({
    ...normalizedLocation,
    sizeMeters: smokeLocation.sizeMeters,
    battleRequest: {
      ...smokeLocation.battleRequest,
      lat: normalizedLocation.lat,
      lon: normalizedLocation.lon,
      selectedName:
        normalizedLocation.battleRequest?.selectedName ??
        normalizedLocation.name ??
        smokeLocation.battleRequest.selectedName,
      region:
        normalizedLocation.battleRequest?.region ??
        normalizedLocation.region ??
        smokeLocation.battleRequest.region,
    },
  });
}

function StageLoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="rounded border border-slate-700 bg-slate-900 px-5 py-4 text-sm shadow-xl">
        Loading Battle Earth stage…
      </div>
    </main>
  );
}

class StageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Battle Earth stage failed to render", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <section className="w-full max-w-lg rounded border border-rose-700 bg-slate-900 p-6 shadow-xl">
          <h1 className="text-lg font-semibold">Stage failed to load</h1>
          <p className="mt-2 text-sm text-slate-300">
            Battle Earth encountered an unexpected error while entering this stage.
          </p>
          <button
            className="mt-5 rounded bg-sky-700 px-4 py-2 text-sm font-semibold hover:bg-sky-600"
            onClick={this.props.onRecover}
          >
            Return
          </button>
        </section>
      </main>
    );
  }
}

export default function App() {
  const [testLabEnabled] = useState(() =>
    isTestLabEnabled(runtimeSearch(), import.meta.env.DEV),
  );
  const [scenarioId, setScenarioId] = useState(() => readScenarioId(runtimeSearch()));
  const [initialLocation] = useState(() => createScenarioLocation(scenarioId));
  const [showTestLab, setShowTestLab] = useState(
    () => testLabEnabled && !getScenario(scenarioId),
  );
  const [stage, setStage] = useState(() =>
    initialLocation ? getStageForLocation(initialLocation) : APP_STAGES.GLOBE,
  );
  const [location, setLocation] = useState(initialLocation);

  const returnToGlobe = () => {
    setLocation(null);
    setStage(APP_STAGES.GLOBE);
  };

  const returnFromStage = () => {
    if (!testLabEnabled) {
      returnToGlobe();
      return;
    }
    setLocation(null);
    setScenarioId(null);
    setStage(APP_STAGES.GLOBE);
    setShowTestLab(true);
    updateScenarioQuery(null);
  };

  const launchLocation = (selectedLocation) => {
    const normalizedLocation =
      scenarioId === SCENARIO_IDS.PROTOTYPE_GLOBE_SMOKE
        ? createGlobeSmokeLocation(selectedLocation)
        : normalizeSelectedLocation(selectedLocation);

    if (!normalizedLocation) {
      returnFromStage();
      return;
    }

    setLocation(normalizedLocation);
    setStage(getStageForLocation(normalizedLocation));
  };

  const launchScenario = (nextScenarioId) => {
    const scenario = getScenario(nextScenarioId);
    if (!scenario) return;

    setScenarioId(nextScenarioId);
    setShowTestLab(false);
    updateScenarioQuery(nextScenarioId);

    if (scenario.startType === SCENARIO_START_TYPES.GLOBE) {
      returnToGlobe();
      return;
    }

    const nextLocation = normalizeSelectedLocation(
      createScenarioLocation(nextScenarioId),
    );
    if (!nextLocation) {
      returnFromStage();
      return;
    }
    setLocation(nextLocation);
    setStage(getStageForLocation(nextLocation));
  };

  if (showTestLab) return <TestLab onLaunchScenario={launchScenario} />;

  if (
    stage === APP_STAGES.CAMPAIGN &&
    canRenderStage(APP_STAGES.CAMPAIGN, location)
  ) {
    return (
      <StageErrorBoundary key={stage} onRecover={returnFromStage}>
        <Suspense fallback={<StageLoadingFallback />}>
          <CampaignStage
            battleRequest={location.battleRequest}
            onBack={returnFromStage}
            onLaunchTactical={launchLocation}
          />
        </Suspense>
      </StageErrorBoundary>
    );
  }

  if (
    stage === APP_STAGES.TACTICAL &&
    canRenderStage(APP_STAGES.TACTICAL, location)
  ) {
    return (
      <StageErrorBoundary key={stage} onRecover={returnFromStage}>
        <Suspense fallback={<StageLoadingFallback />}>
          <TacticalStage
            lat={location.lat}
            lon={location.lon}
            sizeMeters={location.sizeMeters}
            battleRequest={location.battleRequest}
            onBack={returnFromStage}
          />
        </Suspense>
      </StageErrorBoundary>
    );
  }

  return (
    <div className="relative">
      <GlobePicker onSelect={launchLocation} />
      {testLabEnabled ? (
        <button
          type="button"
          onClick={() => {
            setShowTestLab(true);
            updateScenarioQuery(null);
          }}
          className="fixed bottom-5 left-5 z-50 rounded border border-sky-700 bg-slate-950/90 px-4 py-2 text-xs font-semibold text-sky-200 shadow-xl hover:border-sky-400"
        >
          Test Lab
        </button>
      ) : null}
    </div>
  );
}
