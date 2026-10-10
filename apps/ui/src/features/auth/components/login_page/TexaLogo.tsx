import React from "react";
import Image from "next/image";

interface TexaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "center";
  mode?: "image" | "vector";
  is3d?: boolean;
}

/**
 * TexaLogo — The official TexaWave brand mark.
 * Uses the exact company logo asset with 3D depth, chamfer highlights, and drop-shadows.
 */
export function TexaLogo({
  className = "",
  size = "md",
  mode = "image",
  is3d = false,
}: TexaLogoProps) {
  const isCenter = size === "center";

  const dimensions = isCenter
    ? null
    : {
        sm: { width: 120, height: 42 },
        md: { width: 160, height: 56 },
        lg: { width: 200, height: 70 },
        xl: { width: 250, height: 86 },
      }[size];

  if (mode === "image") {
    return (
      <div
        className={`relative inline-flex items-center justify-center select-none ${
          isCenter ? "central-texa-logo" : ""
        } ${is3d ? "texa-brand-shadow" : ""} ${className}`}
        style={
          dimensions
            ? { width: dimensions.width, height: dimensions.height }
            : undefined
        }
      >
        <Image
          src="/logo.png"
          alt="TexaWave Logo"
          width={dimensions ? dimensions.width * 2 : 400}
          height={dimensions ? dimensions.height * 2 : 204}
          className="w-full h-full object-contain filter contrast-115 brightness-102 drop-shadow-sm"
          priority
        />
      </div>
    );
  }

  // Vector fallback
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 76"
      width={dimensions?.width ?? 200}
      height={dimensions?.height ?? 70}
      className={`select-none ${isCenter ? "central-texa-logo" : ""} ${className}`}
      aria-label="TexaWave Logo"
    >
      <defs>
        <linearGradient id="texaGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#84CC16" />
          <stop offset="40%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <linearGradient id="texaDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
      </defs>

      {/* 'T' */}
      <path
        d="M 8 16 L 64 16 L 64 28 L 44 28 L 44 62 L 28 62 L 28 28 L 8 28 Z"
        fill="url(#texaGreenGrad)"
      />
      {/* 'E' */}
      <path
        d="M 72 16 L 114 16 L 114 28 L 88 28 L 88 34 L 110 34 L 110 44 L 88 44 L 88 50 L 116 50 L 116 62 L 72 62 Z"
        fill="url(#texaGreenGrad)"
      />
      {/* 'X' with dynamic green slash */}
      <path
        d="M 122 16 L 138 16 L 152 35 L 166 16 L 182 16 L 162 44 L 184 62 L 168 62 L 151 47 L 134 62 L 118 62 L 141 38 Z"
        fill="url(#texaGreenGrad)"
      />
      <path
        d="M 112 64 Q 152 42 192 14 L 198 18 Q 156 50 118 68 Z"
        fill="#86EFAC"
      />
      {/* 'A' */}
      <path
        d="M 188 62 L 208 16 L 226 16 L 244 62 L 226 62 L 221 48 L 201 48 L 197 62 Z M 205 38 L 217 38 L 211 22 Z"
        fill="url(#texaDarkGrad)"
      />
    </svg>
  );
}
