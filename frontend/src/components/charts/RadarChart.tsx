import { useRef, useEffect } from "react";
import * as d3 from "d3";

interface RadarChartProps {
  scores: {
    accuracy: number;
    stability: number;
    consistency: number;
    threshold: number;
  };
  size?: number;
}

const AXES = [
  { key: "accuracy", label: "Accuracy" },
  { key: "stability", label: "Stability" },
  { key: "consistency", label: "Consistency" },
  { key: "threshold", label: "Threshold" },
] as const;

const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];

export function RadarChart({ scores, size = 280 }: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.28;
    const labelOffset = radius + 28;
    const angleSlice = (2 * Math.PI) / AXES.length;

    const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

    const g = svg.append("g");

    // Grid circles
    GRID_LEVELS.forEach((level) => {
      g.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", rScale(level))
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1);
    });

    // Axis lines + labels
    AXES.forEach((axis, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const lineEnd = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
      const labelPos = {
        x: cx + labelOffset * Math.cos(angle),
        y: cy + labelOffset * Math.sin(angle),
      };

      g.append("line")
        .attr("x1", cx)
        .attr("y1", cy)
        .attr("x2", lineEnd.x)
        .attr("y2", lineEnd.y)
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1);

      g.append("text")
        .attr("x", labelPos.x)
        .attr("y", labelPos.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#64748b")
        .attr("font-size", "12px")
        .text(axis.label);
    });

    // Compute polygon points
    const points = AXES.map((axis, i) => {
      const value = scores[axis.key] ?? 0;
      const angle = i * angleSlice - Math.PI / 2;
      const r = rScale(value);
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), value, angle };
    });

    // Data polygon
    g.append("polygon")
      .attr("points", points.map((p) => `${p.x},${p.y}`).join(" "))
      .attr("fill", "rgba(59, 130, 246, 0.2)")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2);

    // Data dots
    points.forEach((p) => {
      g.append("circle")
        .attr("cx", p.x)
        .attr("cy", p.y)
        .attr("r", 4)
        .attr("fill", "#3b82f6");
    });

  }, [scores, size]);

  return <svg ref={svgRef} width={size} height={size} className="mx-auto" />;
}
