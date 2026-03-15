export function DVPlaceholder({ label }: { label: string }) {
  return (
    <div className="w-full h-48 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50
                    flex items-center justify-center text-slate-400 text-sm">
      [{label} — Chart coming in Sprint 5]
    </div>
  );
}