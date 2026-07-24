function clampMenuPosition(value, fallback, maximum) {
  const number = Number(value);
  return Math.min(Number.isFinite(number) ? number : fallback, maximum);
}

export function DebugPanel({
  buildingCommandMenu = { visible: false },
  missionCommandMenu = { visible: false },
  onIssueBuildingOrder,
  onIssueTerrainMission,
  onCloseBuildingMenu,
  onCloseMissionMenu,
}) {
  return (
    <>
      {missionCommandMenu.visible && (
        <div
          className="absolute z-30 w-48 rounded border border-sky-400/60 bg-slate-950/95 p-3 text-xs shadow-2xl"
          style={{
            left: clampMenuPosition(
              missionCommandMenu.x,
              20,
              window.innerWidth - 220,
            ),
            top: clampMenuPosition(
              missionCommandMenu.y,
              20,
              window.innerHeight - 190,
            ),
          }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-sky-200">Mission order</div>
              <div className="mt-1 text-[11px] text-slate-500">
                Choose the squad&apos;s intent for this location.
              </div>
            </div>
            <button
              className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              onClick={onCloseMissionMenu}
            >
              ×
            </button>
          </div>
          <div className="space-y-1">
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800"
              onClick={() => onIssueTerrainMission?.("defend")}
            >
              Defend
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-rose-800"
              onClick={() => onIssueTerrainMission?.("attack")}
            >
              Attack
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-amber-800"
              onClick={() => onIssueTerrainMission?.("ambush")}
            >
              Ambush
            </button>
          </div>
        </div>
      )}

      {buildingCommandMenu.visible && (
        <div
          className="absolute z-30 w-64 rounded border border-yellow-400/60 bg-slate-950/95 p-3 text-xs shadow-2xl"
          style={{
            left: clampMenuPosition(
              buildingCommandMenu.x,
              20,
              window.innerWidth - 290,
            ),
            top: clampMenuPosition(
              buildingCommandMenu.y,
              20,
              window.innerHeight - 260,
            ),
          }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-yellow-200">Building orders</div>
              <div className="text-slate-400">
                {buildingCommandMenu.state ?? "unknown"} ·{" "}
                {buildingCommandMenu.health ?? 0}/
                {buildingCommandMenu.maxHealth ?? 0} HP
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Choose how the selected squad should use this structure.
              </div>
            </div>
            <button
              className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              onClick={onCloseBuildingMenu}
            >
              ×
            </button>
          </div>
          <div className="space-y-1">
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-sky-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "occupy_building",
                  fireMode: "free",
                })
              }
            >
              Occupy building · fire at will
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-sky-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "occupy_building",
                  fireMode: "return",
                })
              }
            >
              Occupy building · return fire
            </button>
            <button
              className="w-full rounded border border-violet-500/60 bg-violet-950/60 px-2 py-1 text-left hover:bg-violet-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "occupy_building",
                  fireMode: "return",
                  rallyPoint: true,
                  reinforcementPolicy: "maintain",
                })
              }
            >
              Occupy + rally point · maintain strength
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-sky-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "occupy_building",
                  fireMode: "hold",
                })
              }
            >
              Occupy building · ambush / hold fire
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "use_building_cover",
                  fireMode: "free",
                })
              }
            >
              Defensive line · fire at will
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "use_building_cover",
                  fireMode: "return",
                })
              }
            >
              Defensive line · return fire
            </button>
            <button
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-left hover:bg-emerald-800"
              onClick={() =>
                onIssueBuildingOrder?.({
                  type: "use_building_cover",
                  fireMode: "hold",
                })
              }
            >
              Defensive line · hold fire
            </button>
          </div>
        </div>
      )}
    </>
  );
}
