function StatRow({ label, value, tone = "text-slate-100" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 py-1 last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <b className={`max-w-[11rem] truncate text-right ${tone}`}>{value}</b>
    </div>
  );
}

function toneForSide(side) {
  if (side === "friendly") return "text-sky-300";
  if (side === "enemy") return "text-rose-300";
  return "text-slate-300";
}

function toneForContact(contactBearing) {
  return contactBearing && contactBearing !== "n/a" ? "text-rose-300" : "text-emerald-300";
}

export function SquadStatePanel({ infantryStats }) {
  const selected = infantryStats?.selectedSquadId;
  const side = infantryStats?.selectedSide ?? "None";
  const hasContact = infantryStats?.selectedContactBearing && infantryStats.selectedContactBearing !== "n/a";

  return (
    <div className="absolute left-5 bottom-5 z-20 w-80 rounded border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-3 border-b border-slate-800 pb-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Squad State</div>
          <div className={`text-base font-bold ${toneForSide(side)}`}>{selected ? infantryStats.selectedLabel : "No squad selected"}</div>
        </div>
        <div className="rounded bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">{side}</div>
      </div>

      {selected ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <StatRow label="Mission" value={infantryStats?.selectedMissionType ?? infantryStats?.selectedMission ?? "None"} />
            <StatRow label="Status" value={infantryStats?.selectedMissionStatus ?? "None"} />
            <StatRow label="State" value={infantryStats?.selectedState ?? "None"} />
            <StatRow label="Readiness" value={infantryStats?.selectedReadiness ?? "None"} />
            <StatRow label="Time In Position" value={infantryStats?.selectedReadinessTime ?? "0:00"} />
            <StatRow label="Strength" value={`${infantryStats?.selectedAlive ?? 0}/${infantryStats?.selectedSoldiers ?? 0}`} tone={(infantryStats?.selectedStrengthPct ?? 100) < 60 ? "text-amber-300" : "text-emerald-300"} />
            <StatRow label="Pos. Strength" value={infantryStats?.selectedPositionStrength ?? "n/a"} tone={infantryStats?.selectedPositionBroken ? "text-rose-300" : "text-sky-300"} />
            <StatRow label="Confidence" value={infantryStats?.selectedConfidence ?? "Unknown"} tone={(infantryStats?.selectedConfidence ?? "") === "Low" ? "text-amber-300" : "text-emerald-300"} />
            <StatRow label="Position" value={infantryStats?.selectedPositionLabel ?? "Open ground"} />
            <StatRow label="ROE" value={infantryStats?.selectedROE ?? "n/a"} />
            <StatRow label="Contact" value={hasContact ? `${infantryStats.selectedContactBearing} · ${infantryStats?.selectedContactRange ?? 0}m` : "None"} tone={toneForContact(infantryStats?.selectedContactBearing)} />
            <StatRow label="Fallback" value={infantryStats?.selectedFallbackLabel ?? "Known route"} />
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
            <div className="rounded bg-slate-900 p-1"><div className="text-slate-500">Cover</div><b>{infantryStats?.selectedCover ?? 0}%</b></div>
            <div className="rounded bg-slate-900 p-1"><div className="text-slate-500">Supp.</div><b>{infantryStats?.selectedSuppression ?? 0}</b></div>
            <div className="rounded bg-slate-900 p-1"><div className="text-slate-500">W/KIA</div><b>{infantryStats?.selectedWounded ?? 0}/{infantryStats?.selectedCasualties ?? 0}</b></div>
            <div className="rounded bg-slate-900 p-1"><div className="text-slate-500">Route</div><b>{infantryStats?.selectedPathHistory ?? 0}</b></div>
          </div>
        </>
      ) : (
        <p className="text-slate-400">Select a friendly or enemy squad to see its current mission, confidence, contact state, and fallback status.</p>
      )}
    </div>
  );
}
