"use client";

// CRM Core Domain — the extra party layer for celebration modals: glossy floating balloons,
// wing-flapping butterflies flying a real flight path (not a flat confetti particle), and a
// bunting/pennant-flag garland strung across the top — all layered on top of the confetti spray
// `CrmCelebrationHost` already fires. Rendered for every modal-tier celebration EXCEPT `lost` and
// `hold` (see `isPartyModalTone` in `celebrationConfig.ts`) — those two stay deliberately calm,
// per the CRM brief, so a Lost or On-Hold deal never looks like something to celebrate.
import type { CSSProperties } from "react";
import { CelebrationTone } from "./celebrationConfig";
import { prefersReducedMotion } from "./motionPrefs";

type FloatStyle = CSSProperties & Record<`--${string}`, string>;

const BUNTING_COLORS = [
  "#F59E0B",
  "#EF4444",
  "#2454e8",
  "#3B82F6",
  "#A855F7",
  "#14B8A6",
  "#EC4899",
  "#FBBF24",
];

// Each celebration's balloons/butterflies pick up its own tone's hue family, so "Account Created"
// (teal) doesn't fly the same colors as "Deal Won" (green + gold) — matched to `TONE_CONFETTI_COLORS`
// in `CrmCelebrationHost.tsx` for the same tones.
const BALLOON_PALETTES: Partial<Record<CelebrationTone, string[]>> = {
  won: ["#2454e8", "#FFD700", "#1769f5", "#FFC94D"],
  promoted: ["#F59E0B", "#FBBF24", "#2454e8", "#FDE68A"],
  welcome: ["#2454e8", "#3B82F6", "#FFD700", "#1769f5"],
  success: ["#2454e8", "#1769f5", "#12cfe3"],
  teal: ["#0D9488", "#2DD4BF", "#5EEAD4"],
  sky: ["#0284C7", "#38BDF8", "#7DD3FC"],
  pink: ["#DB2777", "#F472B6", "#F9A8D4"],
  violet: ["#7C3AED", "#A78BFA", "#C4B5FD"],
  indigo: ["#4F46E5", "#818CF8", "#A5B4FC"],
  info: ["#3B82F6", "#60A5FA"],
  progress: ["#F59E0B", "#FBBF24"],
};
const DEFAULT_BALLOON_PALETTE = ["#2454e8", "#F59E0B", "#3B82F6"];

const BUTTERFLY_PALETTES: Partial<Record<CelebrationTone, [string, string]>> = {
  won: ["#FFC94D", "#FF8A3D"],
  promoted: ["#F59E0B", "#DB2777"],
  welcome: ["#1769f5", "#3B82F6"],
  success: ["#1769f5", "#2454e8"],
  teal: ["#2DD4BF", "#0D9488"],
  sky: ["#38BDF8", "#0284C7"],
  pink: ["#F472B6", "#DB2777"],
  violet: ["#A78BFA", "#7C3AED"],
  indigo: ["#818CF8", "#4F46E5"],
  info: ["#60A5FA", "#3B82F6"],
  progress: ["#FBBF24", "#F59E0B"],
};
const DEFAULT_BUTTERFLY_PALETTE: [string, string] = ["#F472B6", "#F59E0B"];

interface BalloonSpec {
  left: number;
  bottom: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  wobble: number;
}

// Clustered toward the corners (like the reference image) rather than scattered evenly.
const BALLOON_LAYOUT: BalloonSpec[] = [
  {
    left: 4,
    bottom: -16,
    delay: 0,
    duration: 4.2,
    size: 52,
    drift: 30,
    wobble: 14,
  },
  {
    left: 11,
    bottom: -22,
    delay: 0.35,
    duration: 4.8,
    size: 38,
    drift: -20,
    wobble: 10,
  },
  {
    left: 2,
    bottom: -30,
    delay: 0.9,
    duration: 5.1,
    size: 30,
    drift: 22,
    wobble: 16,
  },
  {
    left: 95,
    bottom: -18,
    delay: 0.15,
    duration: 4.4,
    size: 50,
    drift: -26,
    wobble: 12,
  },
  {
    left: 88,
    bottom: -24,
    delay: 0.55,
    duration: 4.9,
    size: 36,
    drift: 22,
    wobble: 14,
  },
  {
    left: 97,
    bottom: -32,
    delay: 1.05,
    duration: 5.2,
    size: 28,
    drift: -20,
    wobble: 10,
  },
];

// Each flies its own diagonal S-curve across the screen — start/end corners plus a mid waypoint
// (as viewport-percentage offsets from start), a peak bank angle, and overall size/duration.
interface ButterflySpec {
  startLeft: number;
  startBottom: number;
  midX: number;
  midY: number;
  endX: number;
  endY: number;
  bank: number;
  size: number;
  delay: number;
  duration: number;
  flapMs: number;
}

const BUTTERFLY_LAYOUT: ButterflySpec[] = [
  {
    startLeft: 14,
    startBottom: 24,
    midX: 20,
    midY: 40,
    endX: 40,
    endY: 52,
    bank: 14,
    size: 52,
    delay: 0.2,
    duration: 4.6,
    flapMs: 260,
  },
  {
    startLeft: 80,
    startBottom: 30,
    midX: -18,
    midY: 34,
    endX: -38,
    endY: 44,
    bank: -14,
    size: 44,
    delay: 0.9,
    duration: 5.1,
    flapMs: 220,
  },
];

function Balloon({
  color,
  spec,
  uid,
}: {
  color: string;
  spec: BalloonSpec;
  uid: string;
}) {
  const gradId = `crm-balloon-grad-${uid}`;
  const style: FloatStyle = {
    left: `${spec.left}%`,
    bottom: `${spec.bottom}%`,
    width: spec.size,
    height: spec.size * 1.3,
    animationDelay: `${spec.delay}s`,
    animationDuration: `${spec.duration}s`,
    "--crm-balloon-drift": `${spec.drift}px`,
    "--crm-balloon-wobble": `${spec.wobble}px`,
  };
  return (
    <svg
      className="absolute crm-balloon"
      style={style}
      viewBox="0 0 40 56"
      fill="none"
    >
      <defs>
        <radialGradient id={gradId} cx="32%" cy="24%" r="80%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
          <stop offset="22%" stopColor={color} stopOpacity="0.85" />
          <stop offset="70%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </radialGradient>
        <filter
          id={`crm-balloon-shadow-${uid}`}
          x="-40%"
          y="-20%"
          width="180%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="2.2"
            floodColor="#0F1714"
            floodOpacity="0.22"
          />
        </filter>
      </defs>
      <g filter={`url(#crm-balloon-shadow-${uid})`}>
        <ellipse cx="20" cy="20" rx="17" ry="19" fill={`url(#${gradId})`} />
        {/* glossy highlight streak — what sells the 3D read */}
        <ellipse
          cx="13"
          cy="12"
          rx="4.5"
          ry="7"
          fill="#FFFFFF"
          opacity="0.55"
          transform="rotate(-18 13 12)"
        />
        <path
          d="M16.5 37.5 Q20 42 23.5 37.5"
          stroke="rgba(15,23,20,0.28)"
          strokeWidth="1.2"
          fill="none"
        />
        <line
          x1="20"
          y1="39"
          x2="20"
          y2="53"
          stroke="#94A3B8"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

function Butterfly({
  spec,
  colors,
}: {
  spec: ButterflySpec;
  colors: [string, string];
}) {
  const [wingColor, wingColor2] = colors;
  const wrapStyle: FloatStyle = {
    left: `${spec.startLeft}%`,
    bottom: `${spec.startBottom}%`,
    width: spec.size,
    height: spec.size,
    animationDelay: `${spec.delay}s`,
    animationDuration: `${spec.duration}s`,
    "--crm-fly-mid-x": `${spec.midX}vw`,
    "--crm-fly-mid-y": `${-spec.midY}vh`,
    "--crm-fly-end-x": `${spec.endX}vw`,
    "--crm-fly-end-y": `${-spec.endY}vh`,
    "--crm-fly-bank": `${spec.bank}deg`,
    "--crm-flap-ms": `${spec.flapMs}ms`,
  };
  return (
    <div className="absolute crm-butterfly-fly" style={wrapStyle}>
      <svg viewBox="-22 -16 44 32" className="h-full w-full">
        <ellipse cx="0" cy="0" rx="1.3" ry="8.5" fill="#3B2F2A" />
        <circle cx="0" cy="-8" r="1.4" fill="#3B2F2A" />
        <g className="crm-wing-left">
          <path
            d="M-1,-1 C-13,-15 -22,-9 -19,1 C-16,10 -6,7 -1,-1 Z"
            fill={wingColor}
            opacity="0.92"
          />
          <path
            d="M-1,1 C-9,4 -15,13 -8,17 C-3,19 -1,9 -1,1 Z"
            fill={wingColor2}
            opacity="0.9"
          />
          <circle cx="-11" cy="-6" r="1.6" fill="#FFFFFF" opacity="0.4" />
        </g>
        <g className="crm-wing-right">
          <path
            d="M1,-1 C13,-15 22,-9 19,1 C16,10 6,7 1,-1 Z"
            fill={wingColor}
            opacity="0.92"
          />
          <path
            d="M1,1 C9,4 15,13 8,17 C3,19 1,9 1,1 Z"
            fill={wingColor2}
            opacity="0.9"
          />
          <circle cx="11" cy="-6" r="1.6" fill="#FFFFFF" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
}

export function CrmPartyDecor({
  tone,
  uid,
  zIndex,
}: {
  tone: CelebrationTone;
  uid: string;
  zIndex: number;
}) {
  if (prefersReducedMotion()) return null;
  const balloonPalette = BALLOON_PALETTES[tone] || DEFAULT_BALLOON_PALETTE;
  const butterflyPalette =
    BUTTERFLY_PALETTES[tone] || DEFAULT_BUTTERFLY_PALETTE;

  return (
    <div
      aria-hidden
      style={{ zIndex }}
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <style>{`
        @keyframes crm-balloon-rise {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          25% { transform: translateY(-32vh) translateX(calc(var(--crm-balloon-wobble, 12px) * -1)) rotate(-3deg); }
          50% { transform: translateY(-64vh) translateX(var(--crm-balloon-wobble, 12px)) rotate(3deg); }
          75% { transform: translateY(-96vh) translateX(calc(var(--crm-balloon-wobble, 12px) * -1)) rotate(-2deg); }
          92% { opacity: 1; }
          100% { transform: translateY(-130vh) translateX(var(--crm-balloon-drift, 0px)) rotate(2deg); opacity: 0; }
        }
        .crm-balloon { animation-name: crm-balloon-rise; animation-fill-mode: forwards; }
        @keyframes crm-butterfly-fly {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          50% { transform: translate(var(--crm-fly-mid-x), var(--crm-fly-mid-y)) rotate(var(--crm-fly-bank)); }
          92% { opacity: 1; }
          100% { transform: translate(var(--crm-fly-end-x), var(--crm-fly-end-y)) rotate(0deg); opacity: 0; }
        }
        .crm-butterfly-fly { animation-name: crm-butterfly-fly; animation-timing-function: ease-in-out; animation-fill-mode: forwards; }
        @keyframes crm-wing-flap-left { 0%, 100% { transform: scaleX(1) rotate(0deg); } 50% { transform: scaleX(0.28) rotate(-8deg); } }
        @keyframes crm-wing-flap-right { 0%, 100% { transform: scaleX(1) rotate(0deg); } 50% { transform: scaleX(0.28) rotate(8deg); } }
        .crm-wing-left { transform-origin: 0px 0px; animation: crm-wing-flap-left var(--crm-flap-ms, 250ms) ease-in-out infinite; }
        .crm-wing-right { transform-origin: 0px 0px; animation: crm-wing-flap-right var(--crm-flap-ms, 250ms) ease-in-out infinite; }
        @keyframes crm-bunting-sway {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        .crm-bunting-flag { animation: crm-bunting-sway 2.6s ease-in-out infinite; transform-origin: top center; }
        @keyframes crm-bunting-drop {
          0% { transform: translateY(-14px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .crm-bunting-wrap { animation: crm-bunting-drop 0.5s ease-out both; }
      `}</style>

      {BALLOON_LAYOUT.map((spec, i) => (
        <Balloon
          key={i}
          color={balloonPalette[i % balloonPalette.length] as string}
          spec={spec}
          uid={`${uid}-b${i}`}
        />
      ))}

      {BUTTERFLY_LAYOUT.map((spec, i) => (
        <Butterfly key={i} spec={spec} colors={butterflyPalette} />
      ))}

      <svg
        className="absolute left-0 top-0 h-20 w-full crm-bunting-wrap"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
      >
        <path
          d="M0,10 Q 240,48 480,12 T 960,12 T 1440,10"
          fill="none"
          stroke="#94A3B8"
          strokeWidth="2"
        />
        {Array.from({ length: 14 }).map((_, i) => {
          const x = (1440 / 13) * i;
          const t = i / 13;
          // Rough visual match to the string's path above — a gentle double-sag.
          const y = 10 + Math.sin(t * Math.PI * 2) * 20 + 14;
          const color = BUNTING_COLORS[i % BUNTING_COLORS.length];
          return (
            <g
              key={i}
              className="crm-bunting-flag"
              style={{
                animationDelay: `${(i % 6) * 0.12}s`,
                transformOrigin: `${x}px ${y}px`,
              }}
            >
              <polygon
                points={`${x - 14},${y} ${x + 14},${y} ${x},${y + 30}`}
                fill={color}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="1.5"
                opacity={0.98}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default CrmPartyDecor;
