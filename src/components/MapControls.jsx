const PRESETS = [
  { name: "Small Slice Test Map", lat: 44.849758, lon: -93.289793, sizeMeters: 350 },
  { name: "Default Test Site", lat: 44.8500907, lon: -93.2885465, sizeMeters: 1000 },
  { name: "NYC", lat: 40.7061, lon: -74.0092 },
  { name: "London", lat: 51.5033, lon: -0.1195 },
  { name: "Creek Falls", lat: 44.9081934, lon: -93.2880537 },
  { name: "Da Lat, VN", lat: 11.9404, lon: 108.4583 },
  { name: "Mpls Gorge", lat: 44.905, lon: -93.205 },
  { name: "Duluth Harbor", lat: 46.778, lon: -92.092 },
  { name: "Bloomington", lat: 44.8326, lon: -93.3293 }
];

function updateNumber(setConfig, key, value) {
  setConfig((current) => ({ ...current, [key]: Number(value) }));
}

export function MapControls({ open, config, setConfig, onGenerate, onClearCache, analysis }) {
  return (
    <aside
      className={`absolute left-0 top-0 z-10 flex h-full w-80 flex-col gap-4 overflow-y-auto border-r border-slate-700 bg-slate-950/95 p-5 pt-20 shadow-xl transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div>
        <h1 className="border-b border-slate-700 pb-3 text-xl font-bold text-sky-400">Tactical Map Gen</h1>
        <p className="mt-2 text-xs text-slate-400">Map generation refactor slice. Tactical units are intentionally excluded.</p>
      </div>

      <section className="space-y-2">
        <h2 className="border-b border-slate-800 pb-1 text-xs font-bold uppercase tracking-widest text-sky-400">Presets</h2>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              className="rounded bg-slate-800 px-2 py-2 text-xs font-semibold hover:bg-sky-700"
              onClick={() => {
                setConfig((current) => ({ ...current, lat: preset.lat, lon: preset.lon, sizeMeters: preset.sizeMeters ?? current.sizeMeters }));
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-slate-800 pb-1 text-xs font-bold uppercase tracking-widest text-sky-400">Location</h2>
        <label className="block text-xs text-slate-400">Latitude</label>
        <input className="w-full rounded border border-slate-700 bg-slate-900 p-2" type="number" step="0.000001" value={config.lat} onChange={(e) => updateNumber(setConfig, "lat", e.target.value)} />
        <label className="block text-xs text-slate-400">Longitude</label>
        <input className="w-full rounded border border-slate-700 bg-slate-900 p-2" type="number" step="0.000001" value={config.lon} onChange={(e) => updateNumber(setConfig, "lon", e.target.value)} />
        <label className="block text-xs text-slate-400">Size in meters</label>
        <input className="w-full rounded border border-slate-700 bg-slate-900 p-2" type="number" min="100" max="5000" value={config.sizeMeters} onChange={(e) => updateNumber(setConfig, "sizeMeters", e.target.value)} />
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-slate-800 pb-1 text-xs font-bold uppercase tracking-widest text-sky-400">Data</h2>
        <label className="flex items-center justify-between text-sm">
          <span>Real elevation</span>
          <input type="checkbox" checked={config.useRealTerrain} onChange={(e) => setConfig((current) => ({ ...current, useRealTerrain: e.target.checked }))} />
        </label>
        <label className="block text-xs text-slate-400">OSM data preset</label>
        <select className="w-full rounded border border-slate-700 bg-slate-900 p-2" value={config.osmProfile} onChange={(e) => setConfig((current) => ({ ...current, osmProfile: e.target.value }))}>
          <option value="broadBase">broad base</option>
          <option value="expanded">expanded/broad</option>
          <option value="core">core/broad</option>
          <option value="tactical">tactical/broad</option>
          <option value="terrainOnly">terrain only</option>
        </select>
      </section>

      <button className="rounded bg-sky-700 p-3 font-bold hover:bg-sky-600" onClick={onGenerate}>Generate Map</button>
      <button className="rounded bg-red-800 p-2 text-sm font-bold hover:bg-red-700" onClick={onClearCache}>Clear Saved Maps</button>

      <section className="space-y-2">
        <h2 className="border-b border-slate-800 pb-1 text-xs font-bold uppercase tracking-widest text-sky-400">Top OSM Tags</h2>
        <div className="max-h-64 overflow-y-auto rounded border border-slate-800 bg-black/30 p-2 text-xs">
          {analysis.length === 0 ? <p className="text-slate-500">Generate a map to see tag counts.</p> : null}
          {analysis.map(([tag, count]) => (
            <div key={tag} className="flex justify-between gap-4 border-b border-slate-900 py-1">
              <span className="truncate text-slate-300">{tag}</span>
              <span className="text-sky-300">{count}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
