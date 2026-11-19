import React from "react";

export default function WorkstationIllustration({ ws = {} }) {
  const status = ws.status || "Unknown";
  const glowColor =
    status === "Available"
      ? "#10B981"
      : status === "In use"
      ? "#0284C7"
      : status === "Idle"
      ? "#F59E0B"
      : status === "Maintenance"
      ? "#8B5CF6"
      : "#64748B";

  const safeId = (ws.id || "ws").replace(/[^a-zA-Z0-9]/g, "-");
  const bgGradId = `ws-bg-${safeId}`;
  const screenGradId = `scr-${safeId}`;
  const isAvailable = status === "Available";

  return (
    <svg
      className="airbnb-listing-illustration"
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bgGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A2332" />
          <stop offset="100%" stopColor="#0E141E" />
        </linearGradient>
        <linearGradient id={screenGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
        <filter id={`glow-${safeId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background Wall & Room */}
      <rect width="320" height="200" fill={`url(#${bgGradId})`} />

      {/* Subtle Lab Ambient Grid */}
      <g opacity="0.07" stroke="#94A3B8" strokeWidth="1">
        <line x1="0" y1="40" x2="320" y2="40" />
        <line x1="0" y1="80" x2="320" y2="80" />
        <line x1="0" y1="120" x2="320" y2="120" />
        <line x1="80" y1="0" x2="80" y2="160" />
        <line x1="160" y1="0" x2="160" y2="160" />
        <line x1="240" y1="0" x2="240" y2="160" />
      </g>

      {/* Monitor Ambient Backlight Glow */}
      <ellipse
        cx="160"
        cy="85"
        rx="85"
        ry="50"
        fill={glowColor}
        opacity="0.22"
        filter={`url(#glow-${safeId})`}
      />

      {/* Modern Desk Surface */}
      <polygon points="20,158 300,158 320,200 0,200" fill="#243042" />
      <line x1="0" y1="158" x2="320" y2="158" stroke="#334155" strokeWidth="2" />
      <line
        x1="0"
        y1="162"
        x2="320"
        y2="162"
        stroke={glowColor}
        strokeWidth="1"
        opacity="0.3"
      />

      {/* Monitor Stand */}
      <path d="M152 135 L168 135 L164 162 L156 162 Z" fill="#475569" />
      <ellipse
        cx="160"
        cy="163"
        rx="26"
        ry="4"
        fill="#334155"
        stroke="#475569"
        strokeWidth="1"
      />

      {/* Monitor Outer Frame */}
      <rect
        x="75"
        y="32"
        width="170"
        height="106"
        rx="6"
        fill="#0B0F17"
        stroke="#334155"
        strokeWidth="2"
      />

      {/* Monitor Screen Panel */}
      <rect
        x="80"
        y="37"
        width="160"
        height="96"
        rx="3"
        fill={`url(#${screenGradId})`}
      />

      {/* Screen UI Content */}
      {isAvailable ? (
        <g opacity="0.9">
          <circle cx="90" cy="46" r="2.5" fill="#EF4444" />
          <circle cx="98" cy="46" r="2.5" fill="#F59E0B" />
          <circle cx="106" cy="46" r="2.5" fill="#10B981" />
          <line
            x1="88"
            y1="56"
            x2="135"
            y2="56"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="88"
            y1="66"
            x2="185"
            y2="66"
            stroke="#38BDF8"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.75"
          />
          <line
            x1="88"
            y1="74"
            x2="155"
            y2="74"
            stroke="#94A3B8"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.5"
          />
          <line
            x1="88"
            y1="82"
            x2="215"
            y2="82"
            stroke="#A78BFA"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.6"
          />
          <line
            x1="88"
            y1="90"
            x2="140"
            y2="90"
            stroke="#10B981"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.8"
          />
          <rect x="88" y="100" width="8" height="12" fill="#10B981" opacity="0.8" />
          <text
            x="100"
            y="110"
            fontFamily="monospace"
            fontSize="8"
            fill="#10B981"
            fontWeight="bold"
          >
            ONLINE
          </text>
        </g>
      ) : status === "In use" ? (
        <g opacity="0.9">
          <rect x="84" y="42" width="28" height="86" fill="#0D1117" opacity="0.6" />
          <line x1="90" y1="50" x2="104" y2="50" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="90" y1="56" x2="108" y2="56" stroke="#94A3B8" strokeWidth="1.5" />
          <line x1="90" y1="62" x2="102" y2="62" stroke="#94A3B8" strokeWidth="1.5" />
          <line
            x1="120"
            y1="52"
            x2="180"
            y2="52"
            stroke="#F472B6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="120"
            y1="62"
            x2="220"
            y2="62"
            stroke="#38BDF8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="130"
            y1="72"
            x2="195"
            y2="72"
            stroke="#34D399"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="130"
            y1="82"
            x2="205"
            y2="82"
            stroke="#FBBF24"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="120"
            y1="92"
            x2="160"
            y2="92"
            stroke="#818CF8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            x="175"
            y="118"
            fontFamily="sans-serif"
            fontSize="8"
            fill="#38BDF8"
            fontWeight="600"
          >
            IN USE
          </text>
        </g>
      ) : (
        <g opacity="0.4" textAnchor="middle">
          <circle cx="160" cy="80" r="14" fill="none" stroke="#64748B" strokeWidth="2" />
          <line
            x1="160"
            y1="72"
            x2="160"
            y2="82"
            stroke="#64748B"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text x="160" y="110" fontFamily="sans-serif" fontSize="8" fill="#64748B">
            STANDBY
          </text>
        </g>
      )}

      {/* Slim Modern Keyboard */}
      <rect
        x="110"
        y="168"
        width="100"
        height="18"
        rx="3"
        fill="#1E293B"
        stroke="#334155"
        strokeWidth="1"
      />
      <g opacity="0.3" fill="#64748B">
        <rect x="115" y="171" width="10" height="4" rx="1" />
        <rect x="128" y="171" width="10" height="4" rx="1" />
        <rect x="141" y="171" width="10" height="4" rx="1" />
        <rect x="154" y="171" width="10" height="4" rx="1" />
        <rect x="167" y="171" width="10" height="4" rx="1" />
        <rect x="180" y="171" width="10" height="4" rx="1" />
        <rect x="193" y="171" width="12" height="4" rx="1" />
        <rect x="135" y="179" width="50" height="4" rx="1" />
      </g>

      {/* Ergonomic Mouse */}
      <rect
        x="225"
        y="170"
        width="14"
        height="20"
        rx="6"
        fill="#1E293B"
        stroke="#334155"
        strokeWidth="1"
      />
      <line x1="232" y1="171" x2="232" y2="178" stroke="#475569" strokeWidth="1" />

      {/* Tower Case Silhouette on Right */}
      <rect
        x="260"
        y="80"
        width="36"
        height="85"
        rx="3"
        fill="#111827"
        stroke="#1F2937"
        strokeWidth="1.5"
      />
      <circle cx="278" cy="95" r="3" fill={glowColor} opacity="0.9" />
      <line x1="268" y1="110" x2="288" y2="110" stroke="#374151" strokeWidth="1.5" />
      <line x1="268" y1="116" x2="288" y2="116" stroke="#374151" strokeWidth="1.5" />
    </svg>
  );
}
