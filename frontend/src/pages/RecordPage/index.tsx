import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { TempoDial } from "../../components/TempoDial";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useMetronome } from "../../hooks/useMetronome";
import { saveSession } from "../../lib/sessionService";
import { uploadForAnalysis, ACCEPTED_FORMATS } from "../../lib/uploadService";
import { MIN_TEMPO_BPM, MAX_TEMPO_BPM } from "../../constants/audio";
import type { PerformanceSummary } from "../../data_model/recording";
import { BpmTimelineChart } from "../../components/charts/BpmTimelineChart";

export default function RecordPage() {
  const navigate = useNavigate();
  const { status, error, summary, lengthSeconds, live, start, stop, reset, downloadWav } = useAudioRecorder();

  const { startMetronome, stopMetronome } = useMetronome();

  const [useTempo, setUseTempo] = useState(false);
  const [tempoInput, setTempoInput] = useState("120");
  const [tempoError, setTempoError] = useState<string | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [saveState, setSaveState] = useState<"unsaved" | "saving" | "saved" | "discarded">("unsaved");
  const [uploadSummary, setUploadSummary] = useState<PerformanceSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFilename, setUploadFilename] = useState<string | null>(null);

  async function handleSave() {
    if (!summary) return;

    // Open OS file picker — get the actual saved filename
    const savedName = await downloadWav("recording");
    if (!savedName) return; // User cancelled

    try {
      const res = await saveSession({
        file_location: savedName,
        length_seconds: lengthSeconds,
        stats: summary.stats,
        score: {
          ...summary.scores,
          rank: summary.rank,
          rank_description: summary.description,
        },
      });
      navigate(`/summary/${res.session_id}`);
    } catch {
      // Save to DB failed — go back to results
      setSaveState("unsaved");
    }
  }

  function handleDiscard() {
    if (!window.confirm("Are you sure? This recording will be lost.")) return;
    reset();
    setSaveState("unsaved");
  }

  async function handleStart() {
    const tempo = useTempo ? parseFloat(tempoInput) : undefined;
    setTempoError(null);

    if (tempo !== undefined) {
      if (!Number.isFinite(tempo) || tempo < MIN_TEMPO_BPM || tempo > MAX_TEMPO_BPM) {
        setTempoError(`Tempo must be between ${MIN_TEMPO_BPM} and ${MAX_TEMPO_BPM} BPM.`);
        return;
      }
    }

    setSaveState("unsaved");
    setUploadSummary(null);
    if (metronomeEnabled && tempo) {
      startMetronome(tempo);
    }
    try {
      await start(tempo);
    } catch {
      stopMetronome();
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-selected
    e.target.value = "";

    const tempo = useTempo ? parseFloat(tempoInput) : undefined;
    setUploadError(null);
    setUploadSummary(null);

    if (tempo !== undefined) {
      if (!Number.isFinite(tempo) || tempo < MIN_TEMPO_BPM || tempo > MAX_TEMPO_BPM) {
        setUploadError(`Tempo must be between ${MIN_TEMPO_BPM} and ${MAX_TEMPO_BPM} BPM.`);
        return;
      }
    }

    setUploading(true);

    try {
      const result = await uploadForAnalysis(file, tempo);
      setUploadSummary(result);
      setUploadFilename(file.name);
      setSaveState("unsaved");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Unified summary — from either recording or upload
  const displaySummary = (status === "done" && summary) ? summary : uploadSummary;

  return (
    <div className="min-h-screen bg-slate-100/80">
      <NavBar />

      {/* Main */}
      <main className="max-w-2xl mx-auto mt-12 px-4">
        {status !== "done" && (
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          {/* Status */}
          <p className="text-center text-sm font-medium text-slate-600 capitalize">
            {status === "idle" && "Ready to record"}
            {status === "connecting" && "Connecting..."}
            {status === "recording" && "Recording..."}
            {status === "analysing" && "Analysing performance..."}
            {status === "error" && (error || "An error occurred")}
          </p>

          {/* Mode selector */}
          {(status === "idle" || status === "error") && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Current Mode
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tempo-mode"
                    checked={!useTempo}
                    onChange={() => setUseTempo(false)}
                  />
                  Freeplay
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tempo-mode"
                    checked={useTempo}
                    onChange={() => setUseTempo(true)}
                  />
                  Match Tempo
                </label>

                {useTempo && (
                  <>
                    <div className="flex items-center gap-1 ml-6">
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

                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer ml-6">
                      <input
                        type="checkbox"
                        checked={metronomeEnabled}
                        onChange={(e) => setMetronomeEnabled(e.target.checked)}
                      />
                      Metronome
                    </label>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-400">
                {useTempo
                  ? "Performance is scored against the target BPM set above."
                  : "The starting tempo becomes the baseline. Measures how consistently time is kept."}
              </p>
            </div>
          )}

          {tempoError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
              {tempoError}
            </p>
          )}

          {/* Live tempo dial — visible during recording */}
          {status === "recording" && (
            <TempoDial
              tempoMatch={live.tempoMatch}
              deviation={live.deviation}
              currentBpm={live.currentBpm}
              targetBpm={useTempo ? parseFloat(tempoInput) : live.meanBpm}
            />
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {(status === "idle" || status === "error") && (
              <>
                <button
                  onClick={handleStart}
                  disabled={uploading}
                  className="bg-red-600 text-white rounded-lg px-6 py-2 text-sm font-medium
                             hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Start Recording
                </button>
                <label className="bg-slate-200 text-slate-700 rounded-lg px-6 py-2 text-sm font-medium
                                  hover:bg-slate-300 transition-colors cursor-pointer inline-block">
                  {uploading ? "Analysing..." : "Upload File"}
                  <input
                    type="file"
                    accept={ACCEPTED_FORMATS}
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </>
            )}

            {status === "recording" && (
              <button
                onClick={async () => { stopMetronome(); await stop(); }}
                className="bg-red-800 text-white rounded-lg px-6 py-2 text-sm font-medium
                           hover:bg-red-900 transition-colors"
              >
                Stop Recording
              </button>
            )}

            {status === "error" && (
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

          {/* Upload error */}
          {uploadError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
              {uploadError}
            </p>
          )}
        </div>
        )}

        {/* Results — from recording or upload */}
        {displaySummary && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mt-6 space-y-6">
            {/* Rank */}
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-800">{displaySummary.rank}/10</p>
              <p className="text-sm text-slate-500">{displaySummary.description}</p>
            </div>

            {/* Target & Mean BPM */}
            <div className="flex justify-around text-center">
              <div>
                <p className="text-3xl font-bold text-slate-800">
                  {displaySummary.stats.target_bpm.toFixed(0)}
                </p>
                <p className="text-sm text-slate-500">Target BPM</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800">
                  {displaySummary.stats.mean_bpm.toFixed(1)}
                </p>
                <p className="text-sm text-slate-500">Mean BPM</p>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Score Breakdown</h2>
              {[
                { label: "Accuracy", desc: "How close the tempo was to the target", value: displaySummary.scores.accuracy },
                { label: "Stability", desc: "How steady the tempo stayed over time", value: displaySummary.scores.stability },
                { label: "Consistency", desc: "How even the beat-to-beat timing was", value: displaySummary.scores.consistency },
                { label: "Threshold", desc: "How many beats landed within the allowed window", value: displaySummary.scores.threshold },
              ].map((sc) => (
                <div key={sc.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{sc.label}</p>
                    <p className="text-xs text-slate-400">{sc.desc}</p>
                  </div>
                  <p className="text-lg font-bold text-slate-800">
                    {(sc.value * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>

            {/* BPM timeline */}
            {displaySummary.bpm_timeline && (
              <div className="border-t border-slate-100 pt-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">BPM Over Time</h2>
                <BpmTimelineChart
                  bpmArray={displaySummary.bpm_timeline.bpm_array}
                  timeMidpoints={displaySummary.bpm_timeline.time_midpoints}
                  targetBpm={displaySummary.stats.target_bpm}
                />
              </div>
            )}

            {/* Save / Discard buttons — only for recorded sessions with a WAV */}
            {status === "done" && summary && saveState === "unsaved" && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium
                             hover:bg-blue-700 transition-colors"
                >
                  Save Session
                </button>
                <button
                  onClick={handleDiscard}
                  className="flex-1 bg-slate-200 text-slate-700 rounded-lg py-2 text-sm font-medium
                             hover:bg-slate-300 transition-colors"
                >
                  Discard
                </button>
              </div>
            )}

            {/* Upload save/discard — saves to DB then redirects, no file picker */}
            {uploadSummary && !summary && saveState === "unsaved" && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!uploadSummary || !uploadFilename) return;
                    try {
                      const res = await saveSession({
                        file_location: uploadFilename,
                        length_seconds: 0,
                        stats: uploadSummary.stats,
                        score: {
                          ...uploadSummary.scores,
                          rank: uploadSummary.rank,
                          rank_description: uploadSummary.description,
                        },
                      });
                      navigate(`/summary/${res.session_id}`);
                    } catch {
                      setSaveState("unsaved");
                    }
                  }}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium
                             hover:bg-blue-700 transition-colors"
                >
                  Save Session
                </button>
                <button
                  onClick={() => { setUploadSummary(null); setUploadError(null); setUploadFilename(null); }}
                  className="flex-1 bg-slate-200 text-slate-700 rounded-lg py-2 text-sm font-medium
                             hover:bg-slate-300 transition-colors"
                >
                  Discard
                </button>
              </div>
            )}

            {saveState === "saved" && (
              <p className="text-xs text-slate-400 text-center pt-2">Session saved.</p>
            )}
          </div>
        )}
      </main>

    </div>
  );
}
