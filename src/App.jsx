import { Component, lazy, Suspense, useState } from "react";
import { createPrototypeSmokeLocation } from "./app/prototypeScenario.js";
import {
  APP_STAGES,
  canRenderStage,
  getStageForLocation,
  normalizeSelectedLocation,
} from "./app/stageRouting.js";
import { GlobePicker } from "./components/GlobePicker";

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

function getInitialPrototypeLocation() {
  if (typeof window === "undefined") return null;

  const scenario = new URLSearchParams(window.location.search).get("scenario");
  return scenario === "prototype-smoke" ? createPrototypeSmokeLocation() : null;
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
            Battle Earth encountered an unexpected error while entering this
            stage. Return to the globe and try another location.
          </p>
          <button
            className="mt-5 rounded bg-sky-700 px-4 py-2 text-sm font-semibold hover:bg-sky-600"
            onClick={this.props.onRecover}
          >
            Return to globe
          </button>
        </section>
      </main>
    );
  }
}

export default function App() {
  const [initialLocation] = useState(getInitialPrototypeLocation);
  const [stage, setStage] = useState(() =>
    initialLocation
      ? getStageForLocation(initialLocation)
      : APP_STAGES.GLOBE,
  );
  const [location, setLocation] = useState(initialLocation);

  const returnToGlobe = () => {
    setLocation(null);
    setStage(APP_STAGES.GLOBE);
  };

  const launchLocation = (selectedLocation) => {
    const normalizedLocation = normalizeSelectedLocation(selectedLocation);

    if (!normalizedLocation) {
      returnToGlobe();
      return;
    }

    setLocation(normalizedLocation);
    setStage(getStageForLocation(normalizedLocation));
  };

  if (
    stage === APP_STAGES.CAMPAIGN &&
    canRenderStage(APP_STAGES.CAMPAIGN, location)
  ) {
    return (
      <StageErrorBoundary key={stage} onRecover={returnToGlobe}>
        <Suspense fallback={<StageLoadingFallback />}>
          <CampaignStage
            battleRequest={location.battleRequest}
            onBack={returnToGlobe}
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
      <StageErrorBoundary key={stage} onRecover={returnToGlobe}>
        <Suspense fallback={<StageLoadingFallback />}>
          <TacticalStage
            lat={location.lat}
            lon={location.lon}
            sizeMeters={location.sizeMeters}
            battleRequest={location.battleRequest}
            onBack={returnToGlobe}
          />
        </Suspense>
      </StageErrorBoundary>
    );
  }

  return <GlobePicker onSelect={launchLocation} />;
}
