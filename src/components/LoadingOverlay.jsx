export function LoadingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-lg bg-black/80 p-5 text-sm shadow-xl">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
      <span>Generating map...</span>
    </div>
  );
}
