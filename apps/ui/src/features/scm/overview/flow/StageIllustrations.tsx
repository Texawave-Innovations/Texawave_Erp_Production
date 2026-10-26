import type { ReactElement } from "react";

/** Flat, static "soft-3D" illustrations for each supply-chain stage — plain layered SVG shapes
 * (gradients + shading, no WebGL/three.js), sized to a shared 200x180 viewBox so every stage sits
 * at the same visual scale in the flow row. Purely decorative and non-animated: the only motion
 * anywhere in the scene comes from the CSS hover transform applied by the caller. */

function Ground({ cx = 100 }: { cx?: number }) {
  return (
    <ellipse cx={cx} cy={172} rx={72} ry={9} fill="#0F172A" opacity={0.08} />
  );
}

export function SuppliersIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* smoke */}
      <circle cx="66" cy="34" r="7" fill="#CBD5E1" opacity="0.8" />
      <circle cx="74" cy="22" r="9" fill="#CBD5E1" opacity="0.65" />
      <circle cx="86" cy="12" r="10" fill="#CBD5E1" opacity="0.45" />
      {/* chimneys */}
      <rect x="58" y="38" width="14" height="46" rx="2" fill="#93C5FD" />
      <rect
        x="58"
        y="38"
        width="14"
        height="46"
        rx="2"
        fill="url(#supPipeShade)"
      />
      <rect x="80" y="30" width="14" height="54" rx="2" fill="#60A5FA" />
      <rect
        x="80"
        y="30"
        width="14"
        height="54"
        rx="2"
        fill="url(#supPipeShade)"
      />
      {/* building block */}
      <rect
        x="34"
        y="82"
        width="112"
        height="84"
        rx="4"
        fill="#F1F5F9"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />
      <rect x="134" y="82" width="22" height="84" rx="4" fill="#DCE3EC" />
      <rect x="34" y="78" width="122" height="10" rx="3" fill="#94A3B8" />
      {/* windows */}
      {[0, 1, 2].map((c) => (
        <rect
          key={c}
          x={48 + c * 22}
          y="98"
          width="14"
          height="14"
          rx="2"
          fill="#7DD3FC"
        />
      ))}
      {[0, 1, 2].map((c) => (
        <rect
          key={c}
          x={48 + c * 22}
          y="122"
          width="14"
          height="14"
          rx="2"
          fill="#7DD3FC"
        />
      ))}
      {/* door */}
      <rect x="60" y="142" width="24" height="24" rx="2" fill="#475569" />
      {/* small solar-ish roof accent */}
      <rect
        x="98"
        y="86"
        width="40"
        height="8"
        rx="2"
        fill="#9FCA48"
        opacity="0.85"
      />
      <defs>
        <linearGradient id="supPipeShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1E293B" stopOpacity="0.18" />
          <stop offset="1" stopColor="#1E293B" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ProcurementIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* pallet */}
      <rect x="24" y="150" width="70" height="8" rx="1.5" fill="#B08655" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={28 + i * 13}
          y="150"
          width="4"
          height="10"
          fill="#8B6239"
        />
      ))}
      {/* box stack */}
      <rect x="30" y="112" width="34" height="38" rx="3" fill="#D9A15B" />
      <rect x="30" y="112" width="34" height="10" fill="#C68A43" />
      <rect x="66" y="98" width="26" height="52" rx="3" fill="#C68A43" />
      <rect x="66" y="98" width="26" height="9" fill="#B4763A" />
      <rect x="38" y="90" width="24" height="22" rx="3" fill="#E7B77A" />
      {/* forklift */}
      <rect x="120" y="150" width="6" height="12" fill="#334155" />
      <rect x="158" y="150" width="6" height="12" fill="#334155" />
      <circle cx="123" cy="164" r="8" fill="#1E293B" />
      <circle cx="161" cy="164" r="8" fill="#1E293B" />
      <circle cx="123" cy="164" r="3.5" fill="#64748B" />
      <circle cx="161" cy="164" r="3.5" fill="#64748B" />
      <rect x="112" y="118" width="58" height="30" rx="4" fill="#FACC15" />
      <rect x="122" y="98" width="30" height="24" rx="3" fill="#FDE047" />
      <rect
        x="126"
        y="102"
        width="22"
        height="14"
        rx="2"
        fill="#1E293B"
        opacity="0.75"
      />
      <rect x="96" y="84" width="5" height="66" fill="#334155" />
      <rect x="106" y="84" width="5" height="66" fill="#334155" />
      <rect x="92" y="128" width="26" height="6" fill="#475569" />
      <rect x="92" y="140" width="26" height="6" fill="#475569" />
    </svg>
  );
}

export function WarehouseIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* side shading wall */}
      <rect x="140" y="88" width="22" height="78" rx="3" fill="#DCE3EC" />
      {/* main wall */}
      <rect
        x="34"
        y="88"
        width="112"
        height="78"
        rx="3"
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />
      {/* roof */}
      <polygon points="26,90 100,44 164,90" fill="#2563EB" />
      <polygon
        points="26,90 100,44 100,52 34,90"
        fill="#3B82F6"
        opacity="0.55"
      />
      <rect x="24" y="86" width="142" height="8" rx="2" fill="#1D4ED8" />
      {/* doorway */}
      <rect x="70" y="118" width="60" height="48" rx="3" fill="#334155" />
      {/* boxes glimpsed inside */}
      <rect x="78" y="140" width="18" height="20" rx="2" fill="#D9A15B" />
      <rect x="100" y="134" width="20" height="26" rx="2" fill="#C68A43" />
      {/* side windows */}
      <rect x="42" y="100" width="14" height="14" rx="2" fill="#93C5FD" />
      <rect x="136" y="100" width="10" height="14" rx="2" fill="#93C5FD" />
    </svg>
  );
}

export function InventoryIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* pallet */}
      <rect x="46" y="156" width="108" height="8" rx="1.5" fill="#B08655" />
      {/* bottom row */}
      <rect x="48" y="122" width="36" height="34" rx="3" fill="#D9A15B" />
      <rect x="88" y="118" width="40" height="38" rx="3" fill="#C68A43" />
      <rect x="132" y="126" width="30" height="30" rx="3" fill="#E7B77A" />
      {/* mid row */}
      <rect x="58" y="90" width="34" height="34" rx="3" fill="#E7B77A" />
      <rect x="96" y="84" width="36" height="36" rx="3" fill="#D9A15B" />
      {/* top box */}
      <rect x="74" y="58" width="32" height="30" rx="3" fill="#C68A43" />
      {/* tape lines */}
      {[
        [48, 122, 36],
        [88, 118, 40],
        [58, 90, 34],
        [96, 84, 36],
      ].map(([x, y, w], i) => (
        <rect
          key={i}
          x={Number(x) + Number(w) / 2 - 2}
          y={y}
          width="4"
          height={y === 58 ? 30 : 38}
          fill="#FFF7E8"
          opacity="0.7"
        />
      ))}
    </svg>
  );
}

export function SalesIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* small tree */}
      <rect x="164" y="140" width="6" height="24" fill="#8B6239" />
      <circle cx="167" cy="132" r="14" fill="#6EE7B7" />
      {/* building */}
      <rect x="32" y="60" width="110" height="106" rx="4" fill="#334155" />
      <rect x="32" y="60" width="110" height="40" rx="4" fill="#475569" />
      {[0, 1, 2].map((c) => (
        <rect
          key={c}
          x={44 + c * 30}
          y="70"
          width="18"
          height="18"
          rx="2"
          fill="#93C5FD"
        />
      ))}
      {/* awning */}
      <path d="M28 104 L146 104 L138 122 L36 122 Z" fill="#DC2626" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <polygon
          key={i}
          points={`${30 + i * 20},104 ${40 + i * 20},104 ${37 + i * 20},122 ${28 + i * 20},122`}
          fill="#FFFFFF"
        />
      ))}
      <rect x="30" y="96" width="116" height="9" rx="2" fill="#B91C1C" />
      <rect x="58" y="98" width="60" height="7" rx="2" fill="#FFFFFF" />
      {/* door + window */}
      <rect x="42" y="130" width="30" height="36" rx="2" fill="#1E293B" />
      <rect
        x="80"
        y="128"
        width="54"
        height="38"
        rx="3"
        fill="#BFDBFE"
        stroke="#1E3A8A"
        strokeWidth="1.5"
      />
      <rect
        x="86"
        y="134"
        width="42"
        height="26"
        rx="2"
        fill="#EFF6FF"
        opacity="0.65"
      />
    </svg>
  );
}

export function LogisticsIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* trailer */}
      <rect
        x="26"
        y="92"
        width="96"
        height="60"
        rx="4"
        fill="#E2E8F0"
        stroke="#94A3B8"
        strokeWidth="1.5"
      />
      <rect x="26" y="92" width="96" height="12" rx="4" fill="#CBD5E1" />
      {/* cab */}
      <path
        d="M122 108 H164 a10 10 0 0 1 10 10 v22 a4 4 0 0 1 -4 4 H122 Z"
        fill="#2563EB"
      />
      <path d="M132 116 H156 a6 6 0 0 1 6 6 v10 H132 Z" fill="#BFDBFE" />
      <rect x="118" y="140" width="52" height="12" fill="#1E3A8A" />
      {/* wheels */}
      <circle cx="58" cy="156" r="12" fill="#1E293B" />
      <circle cx="58" cy="156" r="5" fill="#94A3B8" />
      <circle cx="142" cy="156" r="12" fill="#1E293B" />
      <circle cx="142" cy="156" r="5" fill="#94A3B8" />
      {/* tail light */}
      <rect x="18" y="112" width="8" height="16" rx="2" fill="#DC2626" />
    </svg>
  );
}

interface PersonSpec {
  x: number;
  scale: number;
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
}

const PEOPLE: PersonSpec[] = [
  {
    x: 14,
    scale: 0.86,
    shirt: "#475569",
    pants: "#1E293B",
    skin: "#C68A5B",
    hair: "#2B2118",
  },
  {
    x: 50,
    scale: 0.98,
    shirt: "#0EA5A4",
    pants: "#0F3D3B",
    skin: "#E9B48C",
    hair: "#3F2E22",
  },
  {
    x: 88,
    scale: 1.08,
    shirt: "#3B82F6",
    pants: "#1E3A8A",
    skin: "#C68A5B",
    hair: "#1E293B",
  },
  {
    x: 126,
    scale: 0.98,
    shirt: "#F97316",
    pants: "#7C2D12",
    skin: "#E9B48C",
    hair: "#2B2118",
  },
  {
    x: 162,
    scale: 0.86,
    shirt: "#475569",
    pants: "#1E293B",
    skin: "#C68A5B",
    hair: "#3F2E22",
  },
];

function Person({ x, scale, shirt, pants, skin, hair }: PersonSpec) {
  return (
    <g transform={`translate(${x} ${172 - 118 * scale}) scale(${scale})`}>
      {/* legs */}
      <rect x="5" y="70" width="9" height="32" rx="4" fill={pants} />
      <rect x="18" y="70" width="9" height="32" rx="4" fill={pants} />
      {/* arms */}
      <rect x="-4" y="36" width="8" height="28" rx="4" fill={shirt} />
      <rect x="28" y="36" width="8" height="28" rx="4" fill={shirt} />
      {/* torso */}
      <path
        d="M2 36 a14 18 0 0 1 28 0 v34 a5 5 0 0 1 -5 5 H7 a5 5 0 0 1 -5 -5 Z"
        fill={shirt}
      />
      {/* head + hair */}
      <circle cx="16" cy="14" r="12.5" fill={skin} />
      <path
        d="M3.5 15 a12.5 12.5 0 0 1 25 0 v-2 a12.5 8.5 0 0 0 -25 0 Z"
        fill={hair}
      />
    </g>
  );
}

export function CustomerIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {PEOPLE.map((p, i) => (
        <Person key={i} {...p} />
      ))}
    </svg>
  );
}

export function QualityIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* clipboard */}
      <rect
        x="56"
        y="46"
        width="88"
        height="112"
        rx="8"
        fill="#F1F5F9"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />
      <rect x="82" y="38" width="36" height="16" rx="5" fill="#94A3B8" />
      {/* checklist lines */}
      <rect x="70" y="76" width="46" height="6" rx="3" fill="#CBD5E1" />
      <rect x="70" y="94" width="46" height="6" rx="3" fill="#CBD5E1" />
      <rect x="70" y="112" width="30" height="6" rx="3" fill="#CBD5E1" />
      {/* shield badge */}
      <path
        d="M100 116 L128 126 V150 C128 166 116 176 100 182 C84 176 72 166 72 150 V126 Z"
        fill="#22C55E"
      />
      <path
        d="M88 150 L97 159 L114 138"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReportsIcon() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <Ground />
      {/* base plate */}
      <rect x="34" y="150" width="132" height="10" rx="3" fill="#94A3B8" />
      {/* bars */}
      <rect x="54" y="110" width="26" height="40" rx="3" fill="#93C5FD" />
      <rect x="90" y="86" width="26" height="64" rx="3" fill="#2563EB" />
      <rect x="126" y="66" width="26" height="84" rx="3" fill="#1D4ED8" />
      {/* trend line */}
      <polyline
        points="58,96 103,70 139,50"
        fill="none"
        stroke="#22C55E"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="58" cy="96" r="5" fill="#16A34A" />
      <circle cx="103" cy="70" r="5" fill="#16A34A" />
      <circle cx="139" cy="50" r="5" fill="#16A34A" />
    </svg>
  );
}

const STAGE_ILLUSTRATIONS: Record<string, () => ReactElement> = {
  suppliers: SuppliersIcon,
  procurement: ProcurementIcon,
  "goods-receipt": LogisticsIcon,
  "inventory-warehouse": WarehouseIcon,
  orders: SalesIcon,
  quality: QualityIcon,
  reports: ReportsIcon,
};

/** The illustration for a flow stage id (renders nothing for an unknown stage). */
export function StageIllustration({ stageId }: { stageId: string }) {
  const Illustration = STAGE_ILLUSTRATIONS[stageId];
  return Illustration ? <Illustration /> : null;
}
