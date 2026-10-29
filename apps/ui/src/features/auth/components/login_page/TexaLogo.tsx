import React from "react";
import Image from "next/image";

interface TexaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "center";
  mode?: "image" | "vector";
  is3d?: boolean;
  variant?: "full" | "mark";
}

/**
 * TexaLogo — The official TexaOne brand mark.
 * Tagline: "Run Your Business as One."
 * Renders the official scalable SVG vector brand asset with crisp viewBox scaling.
 */
export function TexaLogo({
  className = "",
  size = "md",
  mode: _mode = "image",
  is3d: _is3d = false,
  variant,
}: TexaLogoProps) {
  const isCenter = size === "center";

  // When used at small sizes (e.g. sidebar navigation headers <= 32px height),
  // default to the official mark variant so the tagline is not squeezed into
  // sub-pixel blurriness. Larger sizes default to the full logo.
  const resolvedVariant = variant ?? (size === "sm" ? "mark" : "full");

  // Official logo aspect ratio is 2625:810 (~3.24:1).
  // Official standalone mark aspect ratio is 580:710 (~0.82:1).
  const dimensions = isCenter
    ? null
    : resolvedVariant === "mark"
      ? {
          sm: { width: 28, height: 28 },
          md: { width: 40, height: 49 },
          lg: { width: 56, height: 68 },
          xl: { width: 72, height: 88 },
        }[size]
      : {
          sm: { width: 120, height: 37 },
          md: { width: 195, height: 60 },
          lg: { width: 240, height: 74 },
          xl: { width: 292, height: 90 },
        }[size];

  const altText =
    resolvedVariant === "mark"
      ? "TexaOne"
      : "TexaOne — Run Your Business as One.";

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        isCenter ? "central-texa-logo" : ""
      } ${className}`}
      style={
        dimensions
          ? {
              width:
                className.includes("w-auto") || /\bw-\d+|\bw-\[/.test(className)
                  ? undefined
                  : dimensions.width,
              height:
                className.includes("h-auto") || /\bh-\d+|\bh-\[/.test(className)
                  ? undefined
                  : dimensions.height,
            }
          : undefined
      }
    >
      {resolvedVariant === "mark" ? (
        <Image
          src="/brand/texaone-mark.svg"
          alt={altText}
          width={dimensions ? dimensions.width : 40}
          height={dimensions ? dimensions.height : 49}
          className="h-full w-auto object-contain"
          style={{ width: "auto", height: "100%" }}
          priority
          unoptimized
        />
      ) : (
        <>
          <Image
            src="/brand/texaone-logo.png"
            alt={altText}
            width={dimensions ? dimensions.width : 200}
            height={dimensions ? dimensions.height : 62}
            className="h-full w-auto object-contain aspect-[2625/810] dark:hidden"
            style={{ width: "auto", height: "100%" }}
            priority
            unoptimized
          />
          <Image
            src="/brand/texaone-logo-dark.png"
            alt={altText}
            width={dimensions ? dimensions.width : 200}
            height={dimensions ? dimensions.height : 62}
            className="hidden h-full w-auto object-contain aspect-[2625/810] dark:inline-block"
            style={{ width: "auto", height: "100%" }}
            priority
            unoptimized
          />
        </>
      )}
    </div>
  );
}
