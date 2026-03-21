import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getSessions } from "../../lib/sessionService";
import { DVPlaceholder } from "../../components/DVPlaceholder";
import type { SessionSummary } from "../../data_model/session";

export default function HistoricalDataPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.sessions))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sessions"))
      .finally(() => setLoading(false));
  }, []);

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
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Practice History</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.username}</span>
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
        {/* DV Placeholder */}
        <DVPlaceholder label="Session trends over time" />

        {/* Session list */}
        {loading && <p className="text-sm text-slate-500 text-center">Loading...</p>}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
            {error}
          </p>
        )}

        {!loading && !error && sessions.length === 0 && (
          <p className="text-sm text-slate-500 text-center">
            No sessions yet. Go record one!
          </p>
        )}

        {sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => navigate(`/summary/${s.session_id}`)}
            className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center justify-between
                       hover:shadow-md transition-shadow text-left"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">
                {formatDate(s.recorded_at)}
              </p>
              <p className="text-xs text-slate-500">
                {Math.round(s.length_seconds)}s
                {s.stats_summary?.target_bpm != null && ` · ${s.stats_summary.target_bpm} BPM target`}
              </p>
            </div>
            <div className="text-right">
              {s.score_summary ? (
                <>
                  <p className="text-sm font-bold text-slate-800">
                    {s.score_summary.rank}/10
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.score_summary.rank_description}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">No score</p>
              )}
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}
