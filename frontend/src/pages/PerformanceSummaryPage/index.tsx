import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getSession } from "../../lib/sessionService";
import { DVPlaceholder } from "../../components/DVPlaceholder";
import type { SessionDetail } from "../../data_model/session";

export default function PerformanceSummaryPage() {
  const { user, logout } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getSession(Number(id))
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
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Performance Summary</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.username}</span>
          <button
            onClick={() => navigate("/history")}
            className="text-sm text-blue-600 hover:underline"
          >
            History
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-blue-600 hover:underline"
          >
            Record
          </button>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mt-8 px-4 space-y-6">
        {loading && <p className="text-sm text-slate-500 text-center">Loading...</p>}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
            {error}
          </p>
        )}

        {session && (
          <>
            {/* Overview card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {formatDate(session.recorded_at)}
                </p>
                <p className="text-sm text-slate-500">
                  {Math.round(session.length_seconds)}s
                </p>
              </div>

              {/* Score */}
              {session.score && (
                <div className="text-center space-y-1">
                  <p className="text-4xl font-bold text-slate-800">
                    {session.score.rank}/10
                  </p>
                  <p className="text-sm text-slate-500">
                    {session.score.rank_description}
                  </p>
                </div>
              )}
            </div>

            {/* Stats */}
            {session.stats && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">
                  Tempo Statistics
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-slate-500">Target BPM</dt>
                  <dd className="text-slate-800 font-medium">{session.stats.target_bpm}</dd>

                  <dt className="text-slate-500">Mean BPM</dt>
                  <dd className="text-slate-800 font-medium">{session.stats.mean_bpm.toFixed(1)}</dd>

                  <dt className="text-slate-500">Median BPM</dt>
                  <dd className="text-slate-800 font-medium">{session.stats.median_bpm.toFixed(1)}</dd>

                  <dt className="text-slate-500">Min / Max</dt>
                  <dd className="text-slate-800 font-medium">
                    {session.stats.min_bpm.toFixed(1)} / {session.stats.max_bpm.toFixed(1)}
                  </dd>

                  <dt className="text-slate-500">Std Dev</dt>
                  <dd className="text-slate-800 font-medium">{session.stats.std_dev.toFixed(2)}</dd>

                  <dt className="text-slate-500">Within Threshold</dt>
                  <dd className="text-slate-800 font-medium">
                    {(session.stats.percentage_within_threshold * 100).toFixed(1)}%
                  </dd>
                </dl>
              </div>
            )}

            {/* Score breakdown */}
            {session.score && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">
                  Score Breakdown
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-slate-500">Accuracy</dt>
                  <dd className="text-slate-800 font-medium">{session.score.accuracy.toFixed(2)}</dd>

                  <dt className="text-slate-500">Stability</dt>
                  <dd className="text-slate-800 font-medium">{session.score.stability.toFixed(2)}</dd>

                  <dt className="text-slate-500">Consistency</dt>
                  <dd className="text-slate-800 font-medium">{session.score.consistency.toFixed(2)}</dd>

                  <dt className="text-slate-500">Threshold</dt>
                  <dd className="text-slate-800 font-medium">{session.score.threshold.toFixed(2)}</dd>
                </dl>
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
