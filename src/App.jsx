import { lazy, Suspense, useState } from "react";
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

function StageLoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="rounded border border-slate-700 bg-slate-900 px-5 py-4 text-sm shadow-xl">
        Loading Battle Earth stage…
      </div>
    </main>
  );
}

export default function App() {
  const [stage, setStage] = useState("globe");
  const [location, setLocation] = useState(null);

  if (stage === "campaign" && location?.battleRequest) {
    return (
      <Suspense fallback={<StageLoadingFallback />}>
        <CampaignStage
          battleRequest={location.battleRequest}
          onBack={() => setStage("globe")}
          onLaunchTactical={(loc) => {
            setLocation(loc);
            setStage("tactical");
          }}
        />
      </Suspense>
    );
  }

  if (stage === "tactical" && location) {
    return (
      <Suspense fallback={<StageLoadingFallback />}>
        <TacticalStage
          lat={location.lat}
          lon={location.lon}
          sizeMeters={location.sizeMeters}
          battleRequest={location.battleRequest}
          onBack={() => setStage("globe")}
        />
      </Suspense>
    );
  }

  return (
    <GlobePicker
      onSelect={(loc) => {
        setLocation(loc);
        setStage(
          loc?.battleRequest?.launchType === "campaign"
            ? "campaign"
            : "tactical",
        );
      }}
    />
  );
}
