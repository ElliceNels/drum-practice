/**
 * Live tempo feedback gauge using react-d3-speedometer.
 * Center = on tempo. Left = behind. Right = ahead.
 */

import ReactSpeedometer, { CustomSegmentLabelPosition } from "react-d3-speedometer";

interface TempoDialProps {
  tempoMatch: "on" | "ahead" | "behind" | null;
  deviation: number | null;
  currentBpm: number | null;
  targetBpm: number | null;
}

const MAX_DEVIATION = 30;

function deviationToValue(
  match: "on" | "ahead" | "behind" | null,
  deviation: number | null,
): number {
  if (!match || deviation === null) return 500; // center
  const clamped = Math.min(deviation, MAX_DEVIATION);
  const ratio = clamped / MAX_DEVIATION;
  const offset = ratio * 500;
  if (match === "ahead") return 500 + offset;
  if (match === "behind") return 500 - offset;
  return 500;
}

export function TempoDial({ tempoMatch, deviation, currentBpm, targetBpm }: TempoDialProps) {
  const value = deviationToValue(tempoMatch, deviation);
  const hasTarget = targetBpm !== null && targetBpm > 0;
  const target = targetBpm ?? 0;
  const lowLabel = hasTarget ? `${Math.round(target - MAX_DEVIATION)} BPM` : "";
  const highLabel = hasTarget ? `${Math.round(target + MAX_DEVIATION)} BPM` : "";

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-2xl mx-auto py-4">
      {targetBpm !== null && (
        <p className="text-lg font-semibold text-slate-700">
          Target: {Math.round(targetBpm)} BPM
        </p>
      )}
      <ReactSpeedometer
        width={500}
        height={300}
        minValue={0}
        maxValue={1000}
        value={value}
        customSegmentStops={[0, 330, 670, 1000]}
        segmentColors={["#fca5a5", "#86efac", "#fca5a5"]}
        customSegmentLabels={[
          { text: "Behind", position: CustomSegmentLabelPosition.Inside, color: "#9f1239" },
          { text: "On", position: CustomSegmentLabelPosition.Inside, color: "#166534" },
          { text: "Ahead", position: CustomSegmentLabelPosition.Inside, color: "#9f1239" },
        ]}
        needleColor="#334155"
        needleTransitionDuration={150}
        needleHeightRatio={0.7}
        currentValueText={currentBpm !== null ? `${Math.round(currentBpm)} BPM` : "--- BPM"}
        ringWidth={90}
        labelFontSize="14"
        valueTextFontSize="24"
        textColor="#1e293b"
      />
      <div className="flex justify-between w-full -mt-2 px-8">
        <span className="text-xs text-slate-400">{lowLabel}</span>
        <span className="text-xs text-slate-400">{highLabel}</span>
      </div>
    </div>
  );
}
