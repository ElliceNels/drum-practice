import { useState } from "react";

interface SaveModalProps {
  onSave: (filename: string) => void;
  onDiscard: () => void;
}

export function SaveModal({ onSave, onDiscard }: SaveModalProps) {
  const [filename, setFilename] = useState("recording");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    onSave(filename);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Save Session?</h2>
        <p className="text-sm text-slate-500">
          This will save your performance to history and download the recording.
        </p>

        <div>
          <label htmlFor="filename" className="block text-sm font-medium text-slate-700 mb-1">
            File name
          </label>
          <div className="flex items-center gap-1">
            <input
              id="filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-sm text-slate-400">.wav</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !filename.trim()}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {saving ? "Saving..." : "Save & Download"}
          </button>
          <button
            onClick={onDiscard}
            disabled={saving}
            className="flex-1 bg-slate-200 text-slate-700 rounded-lg py-2 text-sm font-medium
                       hover:bg-slate-300 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
