import React from "react";

export default function LabIllustration({ labName = "" }) {
  const isCyber = /cyber|security/i.test(labName);
  const isProg = /program|code|dev/i.test(labName);
  const isAi = /ai|ml|intelligence|data/i.test(labName);
  const accent = isCyber ? "#10B981" : isAi ? "#8B5CF6" : isProg ? "#0284C7" : "#F59E0B";
  const safeName = (labName || "lab").replace(/[^a-zA-Z0-9]/g, "-");
  const gradId = `labgrad-${safeName}`;

  return (
    <svg
      className="airbnb-lab-illustration"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${gradId})`} />

      {/* Floor */}
      <polygon points="0,110 320,110 320,180 0,180" fill="#182234" opacity="0.9" />
      <line x1="0" y1="110" x2="320" y2="110" stroke="#334155" strokeWidth="2" />

      {/* Server Rack */}
      <rect
        x="25"
        y="30"
        width="36"
        height="85"
        rx="3"
        fill="#0B0F19"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <line x1="30" y1="42" x2="56" y2="42" stroke={accent} strokeWidth="2" opacity="0.8" />
      <line x1="30" y1="52" x2="56" y2="52" stroke="#38BDF8" strokeWidth="2" opacity="0.7" />
      <line x1="30" y1="62" x2="56" y2="62" stroke="#94A3B8" strokeWidth="1.5" opacity="0.6" />
      <line x1="30" y1="72" x2="56" y2="72" stroke={accent} strokeWidth="2" opacity="0.8" />
      <circle cx="34" cy="85" r="2" fill={accent} />
      <circle cx="42" cy="85" r="2" fill="#38BDF8" />
      <circle cx="50" cy="85" r="2" fill="#F59E0B" />

      {/* Row of Computer Workstations */}
      <rect
        x="85"
        y="65"
        width="45"
        height="30"
        rx="3"
        fill="#0F172A"
        stroke="#38BDF8"
        strokeWidth="1.5"
      />
      <rect x="88" y="68" width="39" height="24" rx="2" fill="#1E293B" />
      <line x1="92" y1="76" x2="115" y2="76" stroke={accent} strokeWidth="1.5" />
      <polygon points="80,115 140,115 145,135 75,135" fill="#243042" />

      <rect
        x="160"
        y="60"
        width="55"
        height="36"
        rx="3"
        fill="#0F172A"
        stroke={accent}
        strokeWidth="1.8"
      />
      <rect x="164" y="64" width="47" height="28" rx="2" fill="#1E293B" />
      <line x1="170" y1="74" x2="200" y2="74" stroke={accent} strokeWidth="2" />
      <line x1="170" y1="80" x2="195" y2="80" stroke="#38BDF8" strokeWidth="1.5" />
      <polygon points="150,115 225,115 235,140 140,140" fill="#243042" />

      <rect
        x="245"
        y="65"
        width="45"
        height="30"
        rx="3"
        fill="#0F172A"
        stroke="#818CF8"
        strokeWidth="1.5"
      />
      <rect x="248" y="68" width="39" height="24" rx="2" fill="#1E293B" />
      <line x1="252" y1="76" x2="278" y2="76" stroke="#818CF8" strokeWidth="1.5" />
      <polygon points="235,115 295,115 305,135 225,135" fill="#243042" />

      {/* Ceiling Light Tracks */}
      <line
        x1="70"
        y1="10"
        x2="270"
        y2="10"
        stroke="#E2E8F0"
        strokeWidth="3"
        opacity="0.3"
        strokeLinecap="round"
      />
      <line
        x1="100"
        y1="20"
        x2="240"
        y2="20"
        stroke={accent}
        strokeWidth="1"
        opacity="0.4"
      />
    </svg>
  );
}
