import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { MIN_TEMPO_BPM, MAX_TEMPO_BPM } from "../../constants/audio";

export default function RecordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { status, error, summary, start, stop, reset } = useAudioRecorder();

  const [useTempo, setUseTempo] = useState(false);
  const [tempoInput, setTempoInput] = useState("120");
  const [tempoError, setTempoError] = useState<string | null>(null);

  async function handleStart() {
    const tempo = useTempo ? parseFloat(tempoInput) : undefined;
    setTempoError(null);

    if (tempo !== undefined) {
      if (!Number.isFinite(tempo) || tempo < MIN_TEMPO_BPM || tempo > MAX_TEMPO_BPM) {
        setTempoError(`Tempo must be between ${MIN_TEMPO_BPM} and ${MAX_TEMPO_BPM} BPM.`);
        return;
      }
    }

    await start(tempo);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Drum Practice</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.username}</span>
          <button
            onClick={() => navigate("/history")}
            className="text-sm text-blue-600 hover:underline"
          >
            History
          </button>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          {/* Status */}
          <p className="text-center text-sm font-medium text-slate-600 capitalize">
            {status === "idle" && "Ready to record"}
            {status === "connecting" && "Connecting..."}
            {status === "recording" && "Recording..."}
            {status === "analysing" && "Analysing performance..."}
            {status === "done" && summary && `Rank: ${summary.rank}/10 — ${summary.description}`}
            {status === "error" && (error || "An error occurred")}
          </p>

          {/* Tempo input */}
          {(status === "idle" || status === "done" || status === "error") && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={useTempo}
                  onChange={(e) => setUseTempo(e.target.checked)}
                />
                Set tempo
              </label>
              {useTempo && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={MIN_TEMPO_BPM}
                    max={MAX_TEMPO_BPM}
                    value={tempoInput}
                    onChange={(e) => setTempoInput(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-500">BPM</span>
                </div>
              )}
            </div>
          )}

          {tempoError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
              {tempoError}
            </p>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {(status === "idle" || status === "done" || status === "error") && (
              <button
                onClick={handleStart}
                className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium
                           hover:bg-blue-700 transition-colors"
              >
                Start Recording
              </button>
            )}

            {status === "recording" && (
              <button
                onClick={stop}
                className="bg-red-600 text-white rounded-lg px-6 py-2 text-sm font-medium
                           hover:bg-red-700 transition-colors"
              >
                Stop Recording
              </button>
            )}

            {(status === "done" || status === "error") && (
              <button
                onClick={reset}
                className="bg-slate-200 text-slate-700 rounded-lg px-6 py-2 text-sm font-medium
                           hover:bg-slate-300 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Error detail */}
          {status === "error" && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        {status === "done" && summary && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mt-6 space-y-6">
            {/* Target & Mean BPM */}
            <div className="flex justify-around text-center">
              <div>
                <p className="text-3xl font-bold text-slate-800">
                  {summary.stats.target_bpm.toFixed(0)}
                </p>
                <p className="text-sm text-slate-500">Target BPM</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800">
                  {summary.stats.mean_bpm.toFixed(1)}
                </p>
                <p className="text-sm text-slate-500">Your Mean BPM</p>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Score Breakdown</h2>
              {[
                { label: "Accuracy", desc: "How close your tempo was to the target", value: summary.scores.accuracy },
                { label: "Stability", desc: "How steady your tempo stayed over time", value: summary.scores.stability },
                { label: "Consistency", desc: "How even your beat-to-beat timing was", value: summary.scores.consistency },
                { label: "Threshold", desc: "How many beats landed within the allowed window", value: summary.scores.threshold },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.desc}</p>
                  </div>
                  <p className="text-lg font-bold text-slate-800">
                    {(s.value * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
