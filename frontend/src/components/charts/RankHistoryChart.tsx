import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface SessionPoint {
  session_id: number;
  recorded_at: string;
  rank: number;
  accuracy?: number | null;
  stability?: number | null;
  consistency?: number | null;
  threshold?: number | null;
}

interface RankHistoryChartProps {
  sessions: SessionPoint[];
  onSessionClick?: (sessionId: number) => void;
}

const SCORE_LINES = [
  { key: "accuracy", label: "Accuracy", color: "#3b82f6" },
  { key: "stability", label: "Stability", color: "#10b981" },
  { key: "consistency", label: "Consistency", color: "#f59e0b" },
  { key: "threshold", label: "Threshold", color: "#8b5cf6" },
] as const;

const MARGIN = { top: 20, right: 20, bottom: 40, left: 40 };

export function RankHistoryChart({ sessions, onSessionClick }: RankHistoryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    rank: true,
    accuracy: false,
    stability: false,
    consistency: false,
    threshold: false,
  });

  const width = 600;
  const height = 300;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!svgRef.current || sessions.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Clip path to contain zoomed content
    svg.append("defs")
      .append("clipPath")
      .attr("id", "chart-clip")
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH);

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const chartArea = g.append("g").attr("clip-path", "url(#chart-clip)");

    // Parse dates
    const data = sessions.map((s) => ({
      ...s,
      date: new Date(s.recorded_at),
    }));

    // Scales
    const xExtent = d3.extent(data, (d) => d.date) as [Date, Date];
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 10]).range([innerH, 0]);

    // X axis group (will be updated on zoom)
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${innerH})`);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(10).tickFormat((d) => String(d)))
      .selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", "10px");

    g.selectAll(".domain").attr("stroke", "#cbd5e1");
    g.selectAll(".tick line").attr("stroke", "#e2e8f0");

    function draw(xS: d3.ScaleTime<number, number>) {
      // Clear chart area
      chartArea.selectAll("*").remove();

      // Update X axis
      xAxisG.call(d3.axisBottom(xS).ticks(5).tickFormat((d) => d3.timeFormat("%b %d")(d as Date)));
      xAxisG.selectAll("text").attr("fill", "#64748b").attr("font-size", "10px");
      xAxisG.selectAll(".domain").attr("stroke", "#cbd5e1");
      xAxisG.selectAll(".tick line").attr("stroke", "#e2e8f0");

      // Rank line (toggled)
      if (enabled.rank) {
        const rankLine = d3.line<(typeof data)[0]>()
          .x((d) => xS(d.date))
          .y((d) => yScale(d.rank));

        chartArea.append("path")
          .datum(data)
          .attr("d", rankLine)
          .attr("fill", "none")
          .attr("stroke", "#334155")
          .attr("stroke-width", 2);

        chartArea.selectAll(".rank-dot")
          .data(data)
          .join("circle")
          .attr("cx", (d) => xS(d.date))
          .attr("cy", (d) => yScale(d.rank))
          .attr("r", 5)
          .attr("fill", "#334155")
          .attr("cursor", onSessionClick ? "pointer" : "default")
          .on("click", (_event, d) => {
            if (onSessionClick) onSessionClick(d.session_id);
          });

        chartArea.selectAll(".rank-label")
          .data(data)
          .join("text")
          .attr("x", (d) => xS(d.date))
          .attr("y", (d) => yScale(d.rank) - 10)
          .attr("text-anchor", "middle")
          .attr("fill", "#334155")
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .text((d) => d.rank);
      }

      // Score lines (toggled)
      SCORE_LINES.forEach((sl) => {
        if (!enabled[sl.key]) return;

        const lineData = data.filter((d) => {
          const val = d[sl.key as keyof typeof d];
          return val !== null && val !== undefined;
        });

        if (lineData.length < 2) return;

        const scoreLine = d3.line<(typeof data)[0]>()
          .x((d) => xS(d.date))
          .y((d) => {
            const val = d[sl.key as keyof typeof d] as number;
            return yScale(val * 10);
          });

        chartArea.append("path")
          .datum(lineData)
          .attr("d", scoreLine)
          .attr("fill", "none")
          .attr("stroke", sl.color)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3");

        chartArea.selectAll(`.dot-${sl.key}`)
          .data(lineData)
          .join("circle")
          .attr("cx", (d) => xS(d.date))
          .attr("cy", (d) => {
            const val = d[sl.key as keyof typeof d] as number;
            return yScale(val * 10);
          })
          .attr("r", 3)
          .attr("fill", sl.color);
      });
    }

    // Initial draw
    draw(xScale);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]])
      .on("zoom", (event) => {
        const newX = event.transform.rescaleX(xScale);
        draw(newX);
      });

    svg.call(zoom);
  }, [sessions, enabled, onSessionClick, innerW, innerH, width, height]);

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No sessions yet. Record a session to see trends.
      </p>
    );
  }

  if (sessions.length === 1) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        Record more sessions to see trends over time.
      </p>
    );
  }

  return (
    <div>
      {/* Score line toggles */}
      <div className="flex flex-wrap gap-3 mb-3">
        <span className="text-xs text-slate-500 self-center">Show:</span>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={enabled.rank}
            onChange={() => setEnabled((prev) => ({ ...prev, rank: !prev.rank }))}
            className="accent-current"
            style={{ accentColor: "#334155" }}
          />
          <span style={{ color: "#334155" }} className="font-medium">Rank</span>
        </label>
        {SCORE_LINES.map((sl) => (
          <label key={sl.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={enabled[sl.key]}
              onChange={() => setEnabled((prev) => ({ ...prev, [sl.key]: !prev[sl.key] }))}
              className="accent-current"
              style={{ accentColor: sl.color }}
            />
            <span style={{ color: sl.color }} className="font-medium">{sl.label}</span>
          </label>
        ))}
      </div>

      <svg ref={svgRef} width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} />
      <p className="text-xs text-slate-400 text-center mt-1">Scroll to zoom, drag to pan</p>
    </div>
  );
}
