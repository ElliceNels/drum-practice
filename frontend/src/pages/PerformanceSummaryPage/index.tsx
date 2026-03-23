import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { getSession } from "../../lib/sessionService";
import { DVPlaceholder } from "../../components/DVPlaceholder";
import type { SessionDetail } from "../../data_model/session";

export default function PerformanceSummaryPage() {
  const { id } = useParams<{ id: string }>();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId)) {
      setError("Invalid session identifier.");
      setLoading(false);
      return;
    }
    getSession(sessionId)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load session"))
      .finally(() => setLoading(false));
  }, [id]);

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-slate-100/80">
      <NavBar />

      <main className="max-w-2xl mx-auto mt-8 px-4 space-y-6">
        {loading && <p className="text-sm text-slate-500 text-center">Loading...</p>}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
            {error}
          </p>
        )}

        {session && (
          <>
            {/* Session heading */}
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-800">{session.file_location}</h2>
              <p className="text-sm text-slate-500">
                {formatDate(session.recorded_at)} · {Math.round(session.length_seconds)}s
              </p>
            </div>

            {/* Rank + BPM overview */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
              {session.score && (
                <div className="text-center">
                  <p className="text-4xl font-bold text-slate-800">{session.score.rank}/10</p>
                  <p className="text-sm text-slate-500">{session.score.rank_description}</p>
                </div>
              )}

              {session.stats && (
                <div className="flex justify-around text-center">
                  <div>
                    <p className="text-3xl font-bold text-slate-800">
                      {session.stats.target_bpm.toFixed(0)}
                    </p>
                    <p className="text-sm text-slate-500">Target BPM</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-800">
                      {session.stats.mean_bpm.toFixed(1)}
                    </p>
                    <p className="text-sm text-slate-500">Mean BPM</p>
                  </div>
                </div>
              )}
            </div>

            {/* Score breakdown */}
            {session.score && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Score Breakdown</h2>
                {[
                  { label: "Accuracy", desc: "How close the tempo was to the target", value: session.score.accuracy },
                  { label: "Stability", desc: "How steady the tempo stayed over time", value: session.score.stability },
                  { label: "Consistency", desc: "How even the beat-to-beat timing was", value: session.score.consistency },
                  { label: "Threshold", desc: "How many beats landed within the allowed window", value: session.score.threshold },
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
            )}

            {/* Tempo statistics */}
            {session.stats && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Tempo Statistics</h2>
                {[
                  { label: "Target Tempo", value: `${session.stats.target_bpm.toFixed(1)} BPM` },
                  { label: "Mean Tempo", value: `${session.stats.mean_bpm.toFixed(1)} BPM` },
                  { label: "Median Tempo", value: `${session.stats.median_bpm.toFixed(1)} BPM` },
                  { label: "Range", value: `${session.stats.min_bpm.toFixed(1)} – ${session.stats.max_bpm.toFixed(1)} BPM` },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{s.label}</span>
                    <span className="text-slate-800 font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* DV Placeholder */}
            <DVPlaceholder label="Tempo distribution chart" />
          </>
        )}
      </main>
    </div>
  );
}
