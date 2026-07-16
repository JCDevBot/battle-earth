const STATUS_DOT = {
  Idle: "bg-slate-500",
  Moving: "bg-sky-400",
  Defending: "bg-emerald-400",
  Engaged: "bg-amber-400",
  Retreating: "bg-rose-400",
  "Falling back": "bg-rose-400"
};

function UnitIcon({ squad, selected, onSelect }) {
  const isFriendly = squad.side === "friendly";
  const strength = Number.isFinite(squad.strengthPct) ? squad.strengthPct : 0;
  const sideClass = isFriendly
    ? "border-sky-400/70 bg-sky-950/50 text-sky-200 hover:bg-sky-900/70"
    : "border-rose-400/70 bg-rose-950/50 text-rose-200 hover:bg-rose-900/70";
  const selectedClass = selected ? "ring-2 ring-yellow-300 border-yellow-300" : "";
  const dotClass = STATUS_DOT[squad.state] ?? "bg-slate-500";

  return (
    <button
      className={`relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded border text-[9px] shadow ${sideClass} ${selectedClass}`}
      onClick={() => onSelect(squad.id)}
      title={`${squad.label} · ${squad.alive}/${squad.soldiers} · ${squad.state}`}
      aria-label={`Select ${squad.label}`}
    >
      <span className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span className="text-xl leading-none">♟</span>
      <span className="mt-0.5 font-mono text-[10px] leading-none text-slate-100">{squad.alive}/{squad.soldiers}</span>
      <span className="absolute bottom-0 left-0 h-0.5 rounded bg-current" style={{ width: `${Math.max(0, Math.min(100, strength))}%` }} />
    </button>
  );
}

function UnitStrip({ title, squads, selectedId, onSelect, tone }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={`mb-1 text-[11px] font-bold uppercase tracking-[0.18em] ${tone}`}>{title}</div>
      <div className="flex min-h-[54px] gap-2 overflow-x-auto rounded border border-slate-800/80 bg-slate-950/70 p-1.5">
        {squads.length ? squads.map((squad) => (
          <UnitIcon key={squad.id} squad={squad} selected={selectedId === squad.id} onSelect={onSelect} />
        )) : <div className="flex items-center px-3 text-[11px] text-slate-500">Deploy units</div>}
      </div>
    </div>
  );
}

export function UnitCommandCard({ squad, position, commandMode, onCommand, onHold, onRetreat, onClose }) {
  if (!squad || !position) return null;
  const isFriendly = squad.side === "friendly";
  const strength = Number.isFinite(squad.strengthPct) ? squad.strengthPct : 0;
  const left = Math.max(16, Math.min(window.innerWidth - 292, position.x - 136));
  const top = Math.max(84, Math.min(window.innerHeight - 300, position.y - 210));
  const nameClass = isFriendly ? "text-sky-300" : "text-rose-300";

  return (
    <div
      className="absolute z-30 w-[272px] rounded-lg border border-slate-600/90 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur"
      style={{ left, top }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className={`text-base font-bold ${nameClass}`}>{squad.label}</div>
          <div className="mt-0.5 text-slate-400">Status: <b className="text-slate-100">{squad.state}</b></div>
        </div>
        <button className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onClose}>×</button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-slate-200">{squad.alive}/{squad.soldiers}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
          <div className="h-full bg-lime-400" style={{ width: `${Math.max(0, Math.min(100, strength))}%` }} />
        </div>
        <span className="font-mono text-slate-200">{strength}%</span>
      </div>

      {commandMode ? (
        <div className="rounded border border-yellow-500/60 bg-yellow-950/60 p-2 text-center text-yellow-100">
          {commandMode.label}: click the map to set target
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button className="rounded border border-slate-700 bg-slate-900 px-2 py-2 hover:bg-sky-800" onClick={() => onCommand("move")}>Move</button>
          <button className="rounded border border-slate-700 bg-slate-900 px-2 py-2 hover:bg-emerald-800" onClick={() => onCommand("defend")}>Defend</button>
          <button className="rounded border border-slate-700 bg-slate-900 px-2 py-2 hover:bg-rose-800" onClick={() => onCommand("suppress")}>Suppress</button>
          <button className="rounded border border-slate-700 bg-slate-900 px-2 py-2 hover:bg-orange-800" onClick={onRetreat}>Retreat</button>
          <button className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-2 hover:bg-amber-800" onClick={onHold}>Hold</button>
        </div>
      )}
    </div>
  );
}

export function UnitDashboard({ infantryStats, onSelectSquad }) {
  const squads = infantryStats?.squads ?? [];
  const selectedId = infantryStats?.selectedSquadId ?? null;
  const friendly = squads.filter((squad) => squad.side === "friendly");
  const enemy = squads.filter((squad) => squad.side === "enemy");

  return (
    <div className="absolute inset-x-4 bottom-4 z-20 rounded-lg border border-slate-800/90 bg-slate-950/88 p-2 text-slate-100 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-2 lg:flex-row">
        <UnitStrip title="Friendly" squads={friendly} selectedId={selectedId} onSelect={onSelectSquad} tone="text-sky-300" />
        <UnitStrip title="Enemy" squads={enemy} selectedId={selectedId} onSelect={onSelectSquad} tone="text-rose-300" />
      </div>
    </div>
  );
}
