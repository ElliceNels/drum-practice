import { useRef, useEffect } from "react";
import * as d3 from "d3";

interface BpmTimelineChartProps {
  bpmArray: number[];
  timeMidpoints: number[];
  targetBpm: number;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

export function BpmTimelineChart({ bpmArray, timeMidpoints, targetBpm }: BpmTimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 600;
  const height = 280;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!svgRef.current || bpmArray.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Build data points
    const data = bpmArray.map((bpm, i) => ({
      time: timeMidpoints[i],
      bpm,
    }));

    // Scales
    const xExtent = d3.extent(data, (d) => d.time) as [number, number];
    const bpmMin = d3.min(data, (d) => d.bpm) ?? 0;
    const bpmMax = d3.max(data, (d) => d.bpm) ?? 200;
    const yLo = Math.min(bpmMin, targetBpm) - 7;
    const yHi = Math.max(bpmMax, targetBpm) + 7;

    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([yLo, yHi]).range([innerH, 0]);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${(d as number).toFixed(0)}s`))
      .selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", "10px");

    // X axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "11px")
      .text("Time (seconds)");

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(6))
      .selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", "10px");

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "11px")
      .text("BPM");

    // Style axis lines
    g.selectAll(".domain").attr("stroke", "#cbd5e1");
    g.selectAll(".tick line").attr("stroke", "#e2e8f0");

    // Target BPM line (dashed)
    g.append("line")
      .attr("x1", 0)
      .attr("y1", yScale(targetBpm))
      .attr("x2", innerW)
      .attr("y2", yScale(targetBpm))
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,4");

    // Target BPM label
    g.append("text")
      .attr("x", innerW - 4)
      .attr("y", yScale(targetBpm) - 6)
      .attr("text-anchor", "end")
      .attr("fill", "#ef4444")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text(`Target: ${targetBpm.toFixed(0)}`);

    // BPM line
    const line = d3.line<(typeof data)[0]>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.bpm))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2);
  }, [bpmArray, timeMidpoints, targetBpm, innerW, innerH]);

  if (bpmArray.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No beat-level data available.
      </p>
    );
  }

  return <svg ref={svgRef} width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} />;
}
