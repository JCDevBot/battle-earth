const COLOR_BY_TYPE = {
  info: "text-sky-300",
  success: "text-green-300",
  warn: "text-amber-300",
  error: "text-red-300"
};

export function LogPanel({ logs }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 h-32 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded border border-slate-700 bg-black/75 p-3 font-mono text-xs shadow-xl">
      {logs.length === 0 ? <div className="text-slate-500">Logs will appear here.</div> : null}
      {logs.map((log) => (
        <div key={log.id} className={COLOR_BY_TYPE[log.type] ?? COLOR_BY_TYPE.info}>
          &gt; {log.message}
        </div>
      ))}
    </div>
  );
}
