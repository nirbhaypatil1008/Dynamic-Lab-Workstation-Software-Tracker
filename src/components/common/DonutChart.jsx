import React from "react";

export default function DonutChart({ counts = {}, total = 0, onStatusSelect }) {
  if (!total) {
    return (
      <div
        className="donut-chart-container"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          No workstations
        </span>
      </div>
    );
  }

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { key: "Available", count: counts.Available || 0, color: "var(--color-available)" },
    { key: "In use", count: counts["In use"] || 0, color: "var(--color-occupied)" },
    { key: "Idle", count: counts.Idle || 0, color: "var(--color-idle)" },
    { key: "Offline", count: counts.Offline || 0, color: "var(--color-offline)" },
    { key: "Maintenance", count: counts.Maintenance || 0, color: "var(--color-maintenance)" },
    { key: "Unknown", count: counts.Unknown || 0, color: "var(--color-unknown)" }
  ];

  let cumulative = 0;
  const circles = segments.map((seg) => {
    if (!seg.count) return null;
    const pct = seg.count / total;
    const dash = pct * circumference;
    const offset = circumference - cumulative;
    cumulative += dash;
    return (
      <circle
        key={seg.key}
        cx="90"
        cy="90"
        r={radius}
        fill="none"
        stroke={seg.color}
        strokeWidth="20"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={offset}
        className="donut-segment"
        onClick={() => onStatusSelect && onStatusSelect(seg.key)}
        style={{ cursor: onStatusSelect ? "pointer" : "default" }}
      >
        <title>{`${seg.key}: ${seg.count}`}</title>
      </circle>
    );
  });

  const availPct = Math.round(((counts.Available || 0) / total) * 100);

  return (
    <div className="donut-chart-container">
      <svg viewBox="0 0 180 180" className="donut-chart-svg">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="20"
          opacity="0.3"
        />
        {circles}
      </svg>
      <div className="donut-center">
        <span className="donut-percentage">{availPct}%</span>
        <span className="donut-label">Ready</span>
      </div>
    </div>
  );
}
