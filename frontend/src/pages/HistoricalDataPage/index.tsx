import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { getSessions } from "../../lib/sessionService";
import { RankHistoryChart } from "../../components/charts/RankHistoryChart";
import type { SessionSummary } from "../../data_model/session";

export default function HistoricalDataPage() {
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
      <NavBar />

      <main className="max-w-2xl mx-auto mt-8 px-4 space-y-6">
        {/* Rank history chart */}
        {!loading && sessions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Session Trends</h2>
            <RankHistoryChart
              sessions={sessions
                .filter((s) => s.score_summary && s.recorded_at)
                .map((s) => ({
                  session_id: s.session_id,
                  recorded_at: s.recorded_at!,
                  rank: s.score_summary!.rank,
                  accuracy: s.score_summary!.accuracy,
                  stability: s.score_summary!.stability,
                  consistency: s.score_summary!.consistency,
                  threshold: s.score_summary!.threshold,
                }))}
              onSessionClick={(id) => navigate(`/summary/${id}`)}
            />
          </div>
        )}

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
                {s.stats_summary?.target_bpm != null && ` · ${(Math.round(s.stats_summary.target_bpm * 2) / 2)} BPM target`}
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
