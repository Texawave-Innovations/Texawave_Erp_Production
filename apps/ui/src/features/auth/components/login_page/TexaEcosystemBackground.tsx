import React from "react";
import "./texa-ecosystem.css";

/**
 * TexaEcosystemBackground — Unified 2.5D Animated Enterprise Ecosystem Background.
 *
 * Replaces the isolated floating cards with a single cohesive, living engineering canvas
 * that interconnects Software, Electrical, Mechanical, and Procurement with the central Texa ERP core.
 *
 * Performance & Stability:
 * - Wrapped in React.memo (zero re-renders during user form typing).
 * - GPU-composited CSS keyframes (zero main-thread blocking, zero flickering).
 * - SVG vector layers align 1:1 with the underlying 1024x576 2.5D isometric illustration.
 * - Gentle right-side atmospheric fog guarantees maximum legibility for the foreground login form.
 */
export const TexaEcosystemBackground = React.memo(
  function TexaEcosystemBackground() {
    return (
      <div
        className="texa-ecosystem-viewport fixed inset-0 pointer-events-none select-none overflow-hidden z-0 bg-slate-50"
        aria-hidden="true"
      >
        {/* =========================================================================
          Layer 0: Unified 2.5D Isometric Enterprise Illustration Stage
          Anchored seamlessly across viewport, responsive across all screen sizes.
          ========================================================================= */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-start overflow-hidden">
          <div className="relative w-full h-full min-w-full min-h-full">
            {/* Base high-resolution rendered ecosystem illustration */}
            <img
              src="/texawave_ecosystem_bg.jpg"
              alt=""
              className="w-full h-full object-cover object-left lg:object-center filter contrast-102 brightness-[1.01]"
              loading="eager"
              decoding="async"
            />

            {/* =====================================================================
              Layer 1: Living SVG Vector Overlay (Conduits, Beacons, Data Pulses)
              Precisely mapped to the 1024x576 isometric coordinates of the background.
              ===================================================================== */}
            <svg
              viewBox="0 0 1024 576"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Texa Brand Green Gradient for Data Conduits */}
                <linearGradient
                  id="texaPulseGreen"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#06ba32" stopOpacity="0" />
                  <stop offset="40%" stopColor="#06ba32" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#34d399" stopOpacity="1" />
                  <stop offset="100%" stopColor="#06ba32" stopOpacity="0" />
                </linearGradient>

                {/* High-Tech Cyan Gradient for Core & Telemetry Streams */}
                <linearGradient
                  id="texaPulseCyan"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#00d2ff" stopOpacity="0" />
                  <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.85" />
                  <stop offset="65%" stopColor="#00f2fe" stopOpacity="1" />
                  <stop offset="100%" stopColor="#00d2ff" stopOpacity="0" />
                </linearGradient>

                {/* Vertical Data Beam Gradient */}
                <linearGradient
                  id="texaBeamGrad"
                  x1="0%"
                  y1="100%"
                  x2="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.8" />
                  <stop offset="30%" stopColor="#06ba32" stopOpacity="0.6" />
                  <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>

                {/* Core Breathing Radial Glow */}
                <radialGradient id="coreRadialGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.45" />
                  <stop offset="40%" stopColor="#06ba32" stopOpacity="0.25" />
                  <stop offset="80%" stopColor="#06ba32" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#06ba32" stopOpacity="0" />
                </radialGradient>

                {/* Soft Beacon Glow Filter */}
                <filter
                  id="softGlow"
                  x="-30%"
                  y="-30%"
                  width="160%"
                  height="160%"
                >
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* -----------------------------------------------------------------
                1. Central Texa ERP Core Hub (Cylinder Glow & Vertical Light Rays)
                ----------------------------------------------------------------- */}
              <g className="core-hub-layer">
                {/* Ambient Radial Core Energy Glow */}
                <circle
                  cx="348"
                  cy="282"
                  r="72"
                  fill="url(#coreRadialGlow)"
                  className="ecosystem-core-glow"
                />

                {/* Concentric Coordinate Orbit Ring (Slow rotation) */}
                <ellipse
                  cx="348"
                  cy="282"
                  rx="68"
                  ry="36"
                  fill="none"
                  stroke="#00d2ff"
                  strokeWidth="1.2"
                  strokeDasharray="8 12 3 12"
                  opacity="0.5"
                  className="ecosystem-halo-rotate"
                />

                {/* Vertical Luminous Data Beam shooting up from central database cylinder */}
                <polygon
                  points="338,268 358,268 354,120 342,120"
                  fill="url(#texaBeamGrad)"
                  className="ecosystem-beam-shimmer"
                  style={{ mixBlendMode: "screen" }}
                />

                {/* Fine vertical laser line accents */}
                <line
                  x1="344"
                  y1="265"
                  x2="344"
                  y2="135"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  opacity="0.75"
                  className="ecosystem-beam-shimmer"
                />
                <line
                  x1="352"
                  y1="265"
                  x2="352"
                  y2="140"
                  stroke="#34d399"
                  strokeWidth="1.2"
                  opacity="0.8"
                  className="ecosystem-beam-shimmer"
                />
              </g>

              {/* -----------------------------------------------------------------
                2. Flowing Channels & Conduits (Hub <-> 4 Departments)
                ----------------------------------------------------------------- */}
              <g className="conduit-channels-layer" fill="none">
                {/* CONDUIT 1: Central Hub <---> SOFTWARE (Top-Left Server Pods) */}
                {/* Base channel line */}
                <path
                  d="M 324 265 C 285 240, 245 220, 215 195 C 190 175, 175 160, 155 145"
                  stroke="#00d2ff"
                  strokeWidth="2.5"
                  strokeOpacity="0.3"
                />
                {/* Luminous flowing pulse */}
                <path
                  d="M 324 265 C 285 240, 245 220, 215 195 C 190 175, 175 160, 155 145"
                  stroke="url(#texaPulseGreen)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#softGlow)"
                  className="ecosystem-pulse-out"
                />
                {/* Return telemetry trace */}
                <path
                  d="M 328 272 C 290 248, 250 226, 220 202 C 195 182, 180 167, 160 152"
                  stroke="url(#texaPulseCyan)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="ecosystem-pulse-in"
                />

                {/* CONDUIT 2: Central Hub <---> ELECTRICAL (Top-Right Microchip Lab) */}
                <path
                  d="M 372 262 C 410 240, 450 220, 485 200 C 515 182, 535 170, 560 155"
                  stroke="#06ba32"
                  strokeWidth="2.5"
                  strokeOpacity="0.3"
                />
                <path
                  d="M 372 262 C 410 240, 450 220, 485 200 C 515 182, 535 170, 560 155"
                  stroke="url(#texaPulseGreen)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#softGlow)"
                  className="ecosystem-pulse-fast"
                />
                <path
                  d="M 368 255 C 405 234, 444 214, 478 194 C 508 176, 528 164, 552 148"
                  stroke="url(#texaPulseCyan)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="ecosystem-pulse-slow"
                />

                {/* CONDUIT 3: Central Hub <---> PROCUREMENT (Bottom-Left Logistics Hub) */}
                <path
                  d="M 315 295 C 280 320, 250 345, 225 375 C 205 398, 190 415, 170 435"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeOpacity="0.3"
                />
                <path
                  d="M 315 295 C 280 320, 250 345, 225 375 C 205 398, 190 415, 170 435"
                  stroke="url(#texaPulseCyan)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#softGlow)"
                  className="ecosystem-pulse-in"
                />
                <path
                  d="M 322 302 C 288 328, 258 353, 232 382 C 212 405, 198 422, 178 442"
                  stroke="url(#texaPulseGreen)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="ecosystem-pulse-out"
                />

                {/* CONDUIT 4: Central Hub <---> MECHANICAL (Bottom-Right Robotics Line) */}
                <path
                  d="M 380 298 C 415 322, 450 345, 485 372 C 515 395, 540 412, 570 435"
                  stroke="#06ba32"
                  strokeWidth="2.5"
                  strokeOpacity="0.3"
                />
                <path
                  d="M 380 298 C 415 322, 450 345, 485 372 C 515 395, 540 412, 570 435"
                  stroke="url(#texaPulseGreen)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#softGlow)"
                  className="ecosystem-pulse-out"
                />
                <path
                  d="M 374 305 C 408 330, 442 352, 476 380 C 506 402, 532 420, 562 442"
                  stroke="url(#texaPulseCyan)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="ecosystem-pulse-in"
                />

                {/* -------------------------------------------------------------
                  3. Cross-Domain Interconnecting Circuit Bridges
                  ------------------------------------------------------------- */}
                {/* Bridge A: Procurement Logistics feeding Mechanical Assembly */}
                <path
                  d="M 235 448 L 275 465 L 348 480 L 420 468 L 478 445"
                  stroke="#34d399"
                  strokeWidth="1.6"
                  strokeDasharray="6 8"
                  className="ecosystem-circuit-track"
                />

                {/* Bridge B: Software Logic routing into Electrical System */}
                <path
                  d="M 195 138 L 240 115 L 345 110 L 440 118 L 510 135"
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  strokeDasharray="6 8"
                  className="ecosystem-circuit-track"
                />
              </g>

              {/* -----------------------------------------------------------------
                4. Junction Beacon Nodes (Soft pulsing micro-rings at nexus points)
                ----------------------------------------------------------------- */}
              <g className="junction-nodes-layer">
                {/* Central Core Connection Terminus Points */}
                <circle
                  cx="324"
                  cy="265"
                  r="4.5"
                  fill="#00d2ff"
                  className="ecosystem-beacon"
                />
                <circle
                  cx="372"
                  cy="262"
                  r="4.5"
                  fill="#06ba32"
                  className="ecosystem-beacon-delayed"
                />
                <circle
                  cx="315"
                  cy="295"
                  r="4.5"
                  fill="#38bdf8"
                  className="ecosystem-beacon"
                />
                <circle
                  cx="380"
                  cy="298"
                  r="4.5"
                  fill="#06ba32"
                  className="ecosystem-beacon-delayed"
                />

                {/* Software Domain Terminus */}
                <circle
                  cx="155"
                  cy="145"
                  r="5"
                  fill="#00d2ff"
                  className="ecosystem-beacon"
                />
                <circle
                  cx="215"
                  cy="195"
                  r="4"
                  fill="#34d399"
                  className="ecosystem-beacon-delayed"
                />

                {/* Electrical Domain Terminus */}
                <circle
                  cx="560"
                  cy="155"
                  r="5"
                  fill="#06ba32"
                  className="ecosystem-beacon-delayed"
                />
                <circle
                  cx="485"
                  cy="200"
                  r="4"
                  fill="#00d2ff"
                  className="ecosystem-beacon"
                />

                {/* Procurement Domain Terminus */}
                <circle
                  cx="170"
                  cy="435"
                  r="5"
                  fill="#38bdf8"
                  className="ecosystem-beacon"
                />
                <circle
                  cx="225"
                  cy="375"
                  r="4"
                  fill="#34d399"
                  className="ecosystem-beacon-delayed"
                />

                {/* Mechanical Domain Terminus */}
                <circle
                  cx="570"
                  cy="435"
                  r="5"
                  fill="#06ba32"
                  className="ecosystem-beacon-delayed"
                />
                <circle
                  cx="485"
                  cy="372"
                  r="4"
                  fill="#00d2ff"
                  className="ecosystem-beacon"
                />
              </g>
            </svg>

            {/* =====================================================================
              Layer 2: Ambient Studio Lighting & Vignettes
              Ensures luminous depth on the left without harsh contrast steps.
              ===================================================================== */}
            <div className="absolute inset-0 bg-radial-[at_35%_50%] from-emerald-400/5 via-cyan-400/5 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* =========================================================================
          Layer 3: Ethereal Ambient Aura Behind Frosted Glass Card
          Allows the background ecosystem and conduits to show through the glass card.
          ========================================================================= */}
        <div className="hidden lg:block absolute right-16 top-1/4 w-130 h-130 rounded-full bg-linear-to-tr from-emerald-400/20 via-sky-400/25 to-blue-400/15 blur-3xl pointer-events-none z-10" />
        <div className="hidden lg:block absolute right-32 bottom-1/4 w-90 h-90 rounded-full bg-cyan-300/15 blur-2xl pointer-events-none z-10" />
        <div className="lg:hidden absolute inset-0 bg-slate-50/70 backdrop-blur-[2px] pointer-events-none z-10" />
      </div>
    );
  },
);
