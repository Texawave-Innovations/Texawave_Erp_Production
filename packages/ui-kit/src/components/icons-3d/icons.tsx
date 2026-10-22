import { useId, type SVGProps } from "react";

export interface Icon3DProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * 3D Dashboard Icon
 * Volumetric analytics cube with glowing multi-tier telemetry bars and specular glass facet.
 */
export function Icon3dDashboard({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="3"
          y1="3"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#1769F5" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient
          id={`${id}-bar1`}
          x1="8"
          y1="18"
          x2="12"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient
          id={`${id}-bar2`}
          x1="14"
          y1="12"
          x2="18"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient
          id={`${id}-bar3`}
          x1="20"
          y1="8"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#A5F3FC" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#1769F5"
            floodOpacity="0.35"
          />
        </filter>
      </defs>
      {/* Base 3D Squircle */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        fill={`url(#${id}-bg)`}
        filter={`url(#${id}-glow)`}
      />
      {/* Gloss Highlight Edge */}
      <path
        d="M3 11C3 6.58172 6.58172 3 11 3H21C25.4183 3 29 6.58172 29 11V13C29 13 22 10 16 10C10 10 3 13 3 13V11Z"
        fill="#FFFFFF"
        fillOpacity="0.35"
      />
      {/* 3D Telemetry Grid Bars */}
      <rect
        x="7.5"
        y="17"
        width="4.5"
        height="8"
        rx="2"
        fill={`url(#${id}-bar1)`}
      />
      <rect
        x="13.75"
        y="12"
        width="4.5"
        height="13"
        rx="2"
        fill={`url(#${id}-bar2)`}
      />
      <rect
        x="20"
        y="8"
        width="4.5"
        height="17"
        rx="2"
        fill={`url(#${id}-bar3)`}
      />
      {/* Trend indicator dot */}
      <circle cx="22.25" cy="8.25" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 3D Human Resources / People Icon
 * Rounded dimensional avatar duo with executive identity capsule and lanyard crest.
 */
export function Icon3dHumanResources({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-pri`}
          x1="8"
          y1="5"
          x2="24"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#1769F5" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id={`${id}-sec`}
          x1="16"
          y1="8"
          x2="28"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient
          id={`${id}-gold`}
          x1="10"
          y1="18"
          x2="18"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2.5"
            stdDeviation="2"
            floodColor="#1769F5"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      {/* Background Avatar Body */}
      <circle cx="21" cy="11" r="4" fill={`url(#${id}-sec)`} />
      <path
        d="M15.5 24C15.5 20.5 18 18 21.5 18H23C26.5 18 29 20.5 29 24V25H15.5V24Z"
        fill={`url(#${id}-sec)`}
        opacity="0.85"
      />
      {/* Foreground Avatar Head with Specular Halo */}
      <g filter={`url(#${id}-glow)`}>
        <circle cx="12" cy="10" r="5" fill={`url(#${id}-pri)`} />
        <ellipse
          cx="10.5"
          cy="8"
          rx="2"
          ry="1.2"
          fill="#FFFFFF"
          fillOpacity="0.6"
        />
      </g>
      {/* Foreground Avatar Body */}
      <path
        d="M4 25.5C4 20.5 8 17 13 17C18 17 22 20.5 22 25.5V27H4V25.5Z"
        fill={`url(#${id}-pri)`}
        filter={`url(#${id}-glow)`}
      />
      {/* ID Badge / Crest */}
      <rect
        x="10"
        y="19"
        width="6"
        height="5"
        rx="1.5"
        fill={`url(#${id}-gold)`}
        stroke="#FFFFFF"
        strokeWidth="0.8"
      />
      <line
        x1="11.5"
        y1="21"
        x2="14.5"
        y2="21"
        stroke="#FFFFFF"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Overview / Analytics Pillar Icon
 */
export function Icon3dOverview({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-p1`}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient
          id={`${id}-ring`}
          x1="6"
          y1="6"
          x2="26"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="13"
        fill={`url(#${id}-p1)`}
        fillOpacity="0.15"
      />
      <circle
        cx="16"
        cy="16"
        r="11"
        stroke={`url(#${id}-ring)`}
        strokeWidth="2.5"
        strokeDasharray="50 18"
        strokeLinecap="round"
      />
      {/* Center 3D Pulse Core */}
      <circle cx="16" cy="16" r="5" fill={`url(#${id}-ring)`} />
      <circle cx="14.5" cy="14.5" r="1.5" fill="#FFFFFF" fillOpacity="0.8" />
      <path
        d="M16 8V12M16 20V24M8 16H12M20 16H24"
        stroke="#0284C7"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Time & Leave / Calendar Icon
 * Dimensional flip desk calendar with vibrant rose/coral accent and glowing clock ring.
 */
export function Icon3dTimeLeave({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-cal`}
          x1="4"
          y1="7"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>
        <linearGradient
          id={`${id}-head`}
          x1="4"
          y1="5"
          x2="28"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="50%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient
          id={`${id}-clock`}
          x1="16"
          y1="15"
          x2="28"
          y2="27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <filter
          id={`${id}-shadow`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#E11D48"
            floodOpacity="0.3"
          />
        </filter>
      </defs>
      {/* Calendar Backing */}
      <rect
        x="4"
        y="6"
        width="24"
        height="22"
        rx="5"
        fill={`url(#${id}-cal)`}
        stroke="#CBD5E1"
        strokeWidth="1"
      />
      {/* Calendar Top Header */}
      <rect
        x="4"
        y="6"
        width="24"
        height="7"
        rx="4"
        fill={`url(#${id}-head)`}
        filter={`url(#${id}-shadow)`}
      />
      {/* Binder Rings */}
      <rect
        x="8"
        y="3.5"
        width="2.5"
        height="5"
        rx="1.25"
        fill="#475569"
        stroke="#FFFFFF"
        strokeWidth="0.8"
      />
      <rect
        x="21.5"
        y="3.5"
        width="2.5"
        height="5"
        rx="1.25"
        fill="#475569"
        stroke="#FFFFFF"
        strokeWidth="0.8"
      />
      {/* Floating 3D Time Clock */}
      <g filter={`url(#${id}-shadow)`}>
        <circle
          cx="21"
          cy="21"
          r="6"
          fill={`url(#${id}-clock)`}
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />
        <polyline
          points="21,17.5 21,21 23.5,22.5"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {/* Calendar date grid indicators */}
      <circle cx="9" cy="18" r="1.2" fill="#94A3B8" />
      <circle cx="13" cy="18" r="1.2" fill="#94A3B8" />
      <circle cx="9" cy="22" r="1.2" fill="#94A3B8" />
      <circle cx="13" cy="22" r="1.2" fill="#94A3B8" />
    </svg>
  );
}

/**
 * 3D Operations / Settings Icon
 * Interlocked mechanical gears with polished cobalt finish and specular highlights.
 */
export function Icon3dOperations({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-gear`}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient
          id={`${id}-small`}
          x1="16"
          y1="16"
          x2="30"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#2563EB"
            floodOpacity="0.35"
          />
        </filter>
      </defs>
      {/* Primary 3D Gear */}
      <g filter={`url(#${id}-glow)`}>
        <circle cx="15" cy="15" r="9" fill={`url(#${id}-gear)`} />
        {/* Teeth */}
        <path
          d="M13 3H17V6H13V3ZM13 24H17V27H13V24ZM3 13H6V17H3V13ZM24 13H27V17H24V13ZM6.5 6.5L8.6 8.6L6.5 10.7L4.4 8.6L6.5 6.5ZM21.4 21.4L23.5 23.5L21.4 25.6L19.3 23.5L21.4 21.4ZM23.5 6.5L25.6 8.6L23.5 10.7L21.4 8.6L23.5 6.5ZM8.6 21.4L10.7 23.5L8.6 25.6L6.5 23.5L8.6 21.4Z"
          fill={`url(#${id}-gear)`}
        />
        {/* Center Bearing */}
        <circle cx="15" cy="15" r="4" fill="#FFFFFF" />
        <circle cx="15" cy="15" r="2.5" fill="#1E3A8A" />
        <ellipse
          cx="13.5"
          cy="13.5"
          rx="1.5"
          ry="0.8"
          fill="#FFFFFF"
          fillOpacity="0.6"
        />
      </g>
    </svg>
  );
}

/**
 * 3D Recruitment Icon
 * Dimensional talent portal with verified candidate emblem and search magnifier.
 */
export function Icon3dRecruitment({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="3"
          y1="3"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0C4A6E" />
        </linearGradient>
        <linearGradient
          id={`${id}-badge`}
          x1="18"
          y1="18"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Candidate Silhouette */}
      <circle cx="14" cy="11" r="5" fill={`url(#${id}-bg)`} />
      <path
        d="M5 25C5 20.5 9 17.5 14 17.5C19 17.5 23 20.5 23 25V26.5H5V25Z"
        fill={`url(#${id}-bg)`}
      />
      {/* Verified Badge Checkmark */}
      <circle
        cx="23"
        cy="21"
        r="5.5"
        fill={`url(#${id}-badge)`}
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <polyline
        points="20.5,21 22.5,23 25.5,19.5"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 3D Payroll Icon
 * Dimensional leather wallet with emerging glossy currency bills.
 */
export function Icon3dPayroll({ size = 32, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-wallet`}
          x1="4"
          y1="9"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#0369A1" />
          <stop offset="100%" stopColor="#082F49" />
        </linearGradient>
        <linearGradient
          id={`${id}-bill`}
          x1="8"
          y1="5"
          x2="24"
          y2="15"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
        <linearGradient
          id={`${id}-coin`}
          x1="20"
          y1="16"
          x2="28"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <filter
          id={`${id}-shadow`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#0369A1"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      {/* Emerging Cash Bill */}
      <rect
        x="7"
        y="5"
        width="18"
        height="10"
        rx="2"
        fill={`url(#${id}-bill)`}
        stroke="#FFFFFF"
        strokeWidth="0.8"
      />
      <circle cx="16" cy="10" r="2" fill="#FFFFFF" fillOpacity="0.8" />
      {/* 3D Wallet Body */}
      <rect
        x="4"
        y="10"
        width="24"
        height="17"
        rx="4"
        fill={`url(#${id}-wallet)`}
        filter={`url(#${id}-shadow)`}
      />
      {/* Wallet Flap Clasp */}
      <path
        d="M20 15H27C27.5523 15 28 15.4477 28 16V21C28 21.5523 27.5523 22 27 22H20V15Z"
        fill="#0C4A6E"
      />
      <circle
        cx="24"
        cy="18.5"
        r="2"
        fill={`url(#${id}-coin)`}
        stroke="#FFFFFF"
        strokeWidth="0.6"
      />
      {/* Highlight Rim */}
      <path
        d="M5 13C5 11.3431 6.34315 10 8 10H24C25.6569 10 27 11.3431 27 13"
        stroke="#FFFFFF"
        strokeOpacity="0.3"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * 3D Statutory Compliance Icon
 * Polished steel and cobalt shield with golden security crest.
 */
export function Icon3dCompliance({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-shield`}
          x1="6"
          y1="4"
          x2="26"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#1769F5" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient
          id={`${id}-rim`}
          x1="6"
          y1="4"
          x2="16"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.8"
            floodColor="#1769F5"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      {/* 3D Shield Shell */}
      <path
        d="M16 4L6 7.5V15C6 21.5 10.5 26.5 16 28C21.5 26.5 26 21.5 26 15V7.5L16 4Z"
        fill={`url(#${id}-shield)`}
        filter={`url(#${id}-glow)`}
      />
      {/* Left Specular Facet */}
      <path
        d="M16 4L6 7.5V15C6 21.5 10.5 26.5 16 28V4Z"
        fill={`url(#${id}-rim)`}
        fillOpacity="0.3"
      />
      {/* Embossed Checkmark */}
      <polyline
        points="11,15.5 14.5,19 21,12"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 3D Departments Icon
 * Corporate headquarters architectural glass tower with layered dimensional windows.
 */
export function Icon3dDepartments({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-b1`}
          x1="5"
          y1="10"
          x2="19"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient
          id={`${id}-b2`}
          x1="15"
          y1="5"
          x2="27"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      {/* Main Glass Tower */}
      <rect
        x="13"
        y="5"
        width="13"
        height="23"
        rx="3"
        fill={`url(#${id}-b2)`}
      />
      {/* Secondary Wing */}
      <rect
        x="6"
        y="11"
        width="11"
        height="17"
        rx="3"
        fill={`url(#${id}-b1)`}
      />
      {/* Windows */}
      <circle cx="10" cy="15" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="10" cy="19" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="10" cy="23" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="18" cy="9" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="22" cy="9" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="18" cy="14" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="22" cy="14" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="18" cy="19" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="22" cy="19" r="1.2" fill="#FFFFFF" fillOpacity="0.8" />
    </svg>
  );
}

/**
 * 3D Employee Documents Icon
 * Volumetric folder dossier with file sheets and wax stamp.
 */
export function Icon3dDocuments({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-folder`}
          x1="4"
          y1="8"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
      </defs>
      {/* Tab backing */}
      <path
        d="M4 10C4 8.89543 4.89543 8 6 8H12L15 11H26C27.1046 11 28 11.8954 28 13V25C28 26.1046 27.1046 27 26 27H6C4.89543 27 4 26.1046 4 25V10Z"
        fill={`url(#${id}-folder)`}
      />
      {/* White Paper Inside */}
      <rect x="7" y="11" width="18" height="13" rx="2" fill="#FFFFFF" />
      <line
        x1="10"
        y1="15"
        x2="20"
        y2="15"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="18"
        x2="18"
        y2="18"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="21"
        x2="15"
        y2="21"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Front Folder Lip */}
      <path d="M4 16L7 27H25L28 16H4Z" fill="#0EA5E9" fillOpacity="0.85" />
    </svg>
  );
}

/**
 * 3D Org Chart Icon
 * Hierarchical interconnected tree nodes with glass link connectors.
 */
export function Icon3dOrgChart({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-node1`}
          x1="11"
          y1="4"
          x2="21"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id={`${id}-node2`}
          x1="4"
          y1="19"
          x2="14"
          y2="27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient
          id={`${id}-node3`}
          x1="18"
          y1="19"
          x2="28"
          y2="27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Tree Connectors */}
      <path
        d="M16 12V16M16 16H9V19M16 16H23V19"
        stroke="#94A3B8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top Node */}
      <rect
        x="11"
        y="4"
        width="10"
        height="8"
        rx="2.5"
        fill={`url(#${id}-node1)`}
      />
      <circle cx="16" cy="8" r="1.5" fill="#FFFFFF" />
      {/* Child Node 1 */}
      <rect
        x="4"
        y="19"
        width="10"
        height="8"
        rx="2.5"
        fill={`url(#${id}-node2)`}
      />
      <circle cx="9" cy="23" r="1.5" fill="#FFFFFF" />
      {/* Child Node 2 */}
      <rect
        x="18"
        y="19"
        width="10"
        height="8"
        rx="2.5"
        fill={`url(#${id}-node3)`}
      />
      <circle cx="23" cy="23" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 3D Teams Icon
 * Multi-avatar cluster showing interconnected cross-functional teamwork.
 */
export function Icon3dTeams({ size = 32, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-t1`}
          x1="11"
          y1="4"
          x2="21"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id={`${id}-t2`}
          x1="4"
          y1="11"
          x2="14"
          y2="23"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#DB2777" />
        </linearGradient>
        <linearGradient
          id={`${id}-t3`}
          x1="18"
          y1="11"
          x2="28"
          y2="23"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Left Avatar */}
      <circle cx="9" cy="14" r="3.5" fill={`url(#${id}-t2)`} />
      <path
        d="M4 25C4 22 6.5 20 9 20C11.5 20 14 22 14 25V26H4V25Z"
        fill={`url(#${id}-t2)`}
      />
      {/* Right Avatar */}
      <circle cx="23" cy="14" r="3.5" fill={`url(#${id}-t3)`} />
      <path
        d="M18 25C18 22 20.5 20 23 20C25.5 20 28 22 28 25V26H18V25Z"
        fill={`url(#${id}-t3)`}
      />
      {/* Center Lead Avatar */}
      <circle
        cx="16"
        cy="9"
        r="4.5"
        fill={`url(#${id}-t1)`}
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      <path
        d="M9.5 24C9.5 20 12.5 17.5 16 17.5C19.5 17.5 22.5 20 22.5 24V26H9.5V24Z"
        fill={`url(#${id}-t1)`}
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * 3D Award / Full Month Present Icon
 * Golden starburst medallion with cobalt ribbon.
 */
export function Icon3dAward({ size = 32, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-gold`}
          x1="7"
          y1="4"
          x2="25"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#A16207" />
        </linearGradient>
        <linearGradient
          id={`${id}-ribbon`}
          x1="10"
          y1="16"
          x2="22"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {/* Ribbons */}
      <path d="M12 18L9 28L16 24L23 28L20 18" fill={`url(#${id}-ribbon)`} />
      {/* Medal Medallion */}
      <circle
        cx="16"
        cy="13"
        r="9"
        fill={`url(#${id}-gold)`}
        stroke="#FEF08A"
        strokeWidth="1"
      />
      <circle
        cx="16"
        cy="13"
        r="7"
        stroke="#CA8A04"
        strokeWidth="0.8"
        strokeDasharray="3 2"
      />
      {/* 5-Point Star */}
      <polygon
        points="16,8 17.8,11.5 21.7,12.1 18.8,14.9 19.5,18.8 16,17 12.5,18.8 13.2,14.9 10.3,12.1 14.2,11.5"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * 3D Action Plus / Add Icon
 * Vibrant blue/cyan dimensional button with crisp white plus mark.
 */
export function Icon3dPlus({ size = 20, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-btn`}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="40%" stopColor="#1769F5" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#${id}-btn)`} />
      <ellipse
        cx="12"
        cy="6"
        rx="5"
        ry="1.5"
        fill="#FFFFFF"
        fillOpacity="0.45"
      />
      <path
        d="M12 7V17M7 12H17"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Action Edit / Pencil Icon
 */
export function Icon3dEdit({ size = 20, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-body`}
          x1="6"
          y1="4"
          x2="19"
          y2="17"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path
        d="M16.5 3.5L20.5 7.5L8 20H4V16L16.5 3.5Z"
        fill={`url(#${id}-body)`}
      />
      <path d="M14.5 5.5L18.5 9.5" stroke="#FFFFFF" strokeWidth="1.2" />
      <polygon points="4,20 6.5,19.5 4.5,17.5" fill="#475569" />
    </svg>
  );
}

/**
 * 3D Action Delete / Trash Icon
 */
export function Icon3dDelete({ size = 20, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-can`}
          x1="5"
          y1="8"
          x2="19"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <path
        d="M6 8H18L17 20C17 20.5523 16.5523 21 16 21H8C7.44772 21 7 20.5523 7 20L6 8Z"
        fill={`url(#${id}-can)`}
      />
      <rect
        x="4"
        y="5"
        width="16"
        height="3"
        rx="1.5"
        fill="#BE123C"
        stroke="#FFFFFF"
        strokeWidth="0.8"
      />
      <path
        d="M9 5V3.5C9 3.22386 9.22386 3 9.5 3H14.5C14.7761 3 15 3.22386 15 3.5V5"
        stroke="#BE123C"
        strokeWidth="1.2"
      />
      <line
        x1="10"
        y1="11"
        x2="10"
        y2="17"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="11"
        x2="14"
        y2="17"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Action Export / Download Icon
 */
export function Icon3dExport({ size = 20, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-arr`}
          x1="12"
          y1="3"
          x2="12"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="16"
        width="16"
        height="5"
        rx="2"
        fill="#E2E8F0"
        stroke="#94A3B8"
        strokeWidth="1"
      />
      <polyline
        points="8,10 12,14 16,10"
        stroke={`url(#${id}-arr)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="12"
        y1="3"
        x2="12"
        y2="13"
        stroke={`url(#${id}-arr)`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Action Import / Upload Icon
 */
export function Icon3dImport({ size = 20, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-arr`}
          x1="12"
          y1="14"
          x2="12"
          y2="3"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="16"
        width="16"
        height="5"
        rx="2"
        fill="#E2E8F0"
        stroke="#94A3B8"
        strokeWidth="1"
      />
      <polyline
        points="8,7 12,3 16,7"
        stroke={`url(#${id}-arr)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="12"
        y1="4"
        x2="12"
        y2="14"
        stroke={`url(#${id}-arr)`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Search Icon
 */
export function Icon3dSearch({ size = 20, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-glass`}
          x1="4"
          y1="4"
          x2="16"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke={`url(#${id}-glass)`}
        strokeWidth="2.5"
        fill="#38BDF8"
        fillOpacity="0.1"
      />
      <ellipse cx="8" cy="7" rx="3" ry="1" fill="#FFFFFF" fillOpacity="0.5" />
      <line
        x1="15.5"
        y1="15.5"
        x2="20.5"
        y2="20.5"
        stroke="#0284C7"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3D Notification Bell Icon
 */
export function Icon3dBell({ size = 22, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-bell`}
          x1="6"
          y1="4"
          x2="18"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="60%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path
        d="M12 3C10.8954 3 10 3.89543 10 5V5.2C7.2 6.2 5 8.8 5 12V16L3 18V19H21V18L19 16V12C19 8.8 16.8 6.2 14 5.2V5C14 3.89543 13.1046 3 12 3Z"
        fill={`url(#${id}-bell)`}
      />
      <ellipse
        cx="12"
        cy="7"
        rx="3.5"
        ry="1"
        fill="#FFFFFF"
        fillOpacity="0.5"
      />
      <path
        d="M10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20H10Z"
        fill="#B45309"
      />
    </svg>
  );
}

/**
 * 3D Cheer Up / Celebration Hands Icon (🙌)
 * Authentic dual raised celebration hands with volumetric 3D palms, distinct spread fingers,
 * inward-pointing thumbs, specular glass highlights, and vibrant center golden sunburst sparkles.
 */
export function Icon3dCheerHands({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Left Hand Volumetric Gradient */}
        <linearGradient
          id={`${id}-handL`}
          x1="4"
          y1="6"
          x2="14"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Right Hand Volumetric Gradient */}
        <linearGradient
          id={`${id}-handR`}
          x1="18"
          y1="6"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Thumb Gradients */}
        <linearGradient
          id={`${id}-thumbL`}
          x1="8"
          y1="17"
          x2="13"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id={`${id}-thumbR`}
          x1="19"
          y1="17"
          x2="24"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Golden Celebration Sparkle Gradient */}
        <linearGradient
          id={`${id}-gold`}
          x1="12"
          y1="2"
          x2="20"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="40%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>

        {/* 3D Drop Glow Filter */}
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#1769F5"
            floodOpacity="0.38"
          />
        </filter>
        <filter
          id={`${id}-gold-glow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.2"
            floodColor="#F59E0B"
            floodOpacity="0.5"
          />
        </filter>
      </defs>

      {/* Central Golden Celebration Sunburst & Energy Rays */}
      <g filter={`url(#${id}-gold-glow)`}>
        {/* 8-point Faceted Celebration Star */}
        <path
          d="M16 2.5L17.2 5.5L20 4.8L18.8 7.5L21.5 8.8L18.8 10L20 12.8L17.2 12L16 15L14.8 12L12 12.8L13.2 10L10.5 8.8L13.2 7.5L12 4.8L14.8 5.5L16 2.5Z"
          fill={`url(#${id}-gold)`}
        />
        {/* Central Core Star Spark */}
        <circle cx="16" cy="8.8" r="1.8" fill="#FFFFFF" />
      </g>
      {/* Side Energy Sparkles */}
      <circle cx="7" cy="4" r="1.2" fill="#38BDF8" />
      <circle cx="25" cy="4" r="1.2" fill="#38BDF8" />

      {/* LEFT CELEBRATION HAND (🙌) */}
      <g filter={`url(#${id}-glow)`}>
        {/* Inward Incline Palm */}
        <path
          d="M5.5 17C4.8 19.5 5.5 24 8 25.5L11 26C12.8 26 13.8 24 13.5 21L13 17C13 17 10 16 7.5 16.5C6 16.8 5.6 17 5.5 17Z"
          fill={`url(#${id}-handL)`}
        />
        {/* Left Thumb (Pointing Inward toward Center) */}
        <path
          d="M11 18.5C12 18 13.5 18.8 13.8 20C14 21.2 13 22.2 11.8 22L10 21.5L11 18.5Z"
          fill={`url(#${id}-thumbL)`}
        />
        <ellipse
          cx="12.5"
          cy="19.8"
          rx="0.8"
          ry="1.2"
          fill="#FFFFFF"
          fillOpacity="0.4"
        />

        {/* 4 Spread Fingers Fan Outward */}
        {/* Pinky */}
        <rect
          x="4.2"
          y="11.5"
          width="2.4"
          height="6.5"
          rx="1.2"
          fill={`url(#${id}-handL)`}
          transform="rotate(-14 5.4 14.7)"
        />
        <ellipse
          cx="5.2"
          cy="13"
          rx="0.7"
          ry="1.4"
          fill="#FFFFFF"
          fillOpacity="0.45"
          transform="rotate(-14 5.2 13)"
        />

        {/* Ring */}
        <rect
          x="6.4"
          y="8.8"
          width="2.5"
          height="8.5"
          rx="1.25"
          fill={`url(#${id}-handL)`}
          transform="rotate(-8 7.6 13)"
        />
        <ellipse
          cx="7.4"
          cy="10.8"
          rx="0.7"
          ry="1.8"
          fill="#FFFFFF"
          fillOpacity="0.45"
          transform="rotate(-8 7.4 10.8)"
        />

        {/* Middle (Tallest) */}
        <rect
          x="8.8"
          y="7.5"
          width="2.6"
          height="9.8"
          rx="1.3"
          fill={`url(#${id}-handL)`}
          transform="rotate(-2 10.1 12.4)"
        />
        <ellipse
          cx="9.9"
          cy="9.8"
          rx="0.8"
          ry="2.2"
          fill="#FFFFFF"
          fillOpacity="0.5"
          transform="rotate(-2 9.9 9.8)"
        />

        {/* Index */}
        <rect
          x="11.2"
          y="9.2"
          width="2.5"
          height="8.2"
          rx="1.25"
          fill={`url(#${id}-handL)`}
          transform="rotate(4 12.4 13.3)"
        />
        <ellipse
          cx="12.3"
          cy="11.2"
          rx="0.7"
          ry="1.8"
          fill="#FFFFFF"
          fillOpacity="0.45"
          transform="rotate(4 12.3 11.2)"
        />

        {/* Sleek Wrist Base */}
        <rect
          x="7"
          y="25"
          width="4.5"
          height="2"
          rx="1"
          fill="#38BDF8"
          fillOpacity="0.7"
        />
      </g>

      {/* RIGHT CELEBRATION HAND (🙌) - Symmetrical Joyful Pose */}
      <g filter={`url(#${id}-glow)`}>
        {/* Inward Incline Palm */}
        <path
          d="M26.5 17C27.2 19.5 26.5 24 24 25.5L21 26C19.2 26 18.2 24 18.5 21L19 17C19 17 22 16 24.5 16.5C26 16.8 26.4 17 26.5 17Z"
          fill={`url(#${id}-handR)`}
        />
        {/* Right Thumb (Pointing Inward toward Center) */}
        <path
          d="M21 18.5C20 18 18.5 18.8 18.2 20C18 21.2 19 22.2 20.2 22L22 21.5L21 18.5Z"
          fill={`url(#${id}-thumbR)`}
        />
        <ellipse
          cx="19.5"
          cy="19.8"
          rx="0.8"
          ry="1.2"
          fill="#FFFFFF"
          fillOpacity="0.4"
        />

        {/* 4 Spread Fingers Fan Outward */}
        {/* Index */}
        <rect
          x="18.3"
          y="9.2"
          width="2.5"
          height="8.2"
          rx="1.25"
          fill={`url(#${id}-handR)`}
          transform="rotate(-4 19.6 13.3)"
        />
        <ellipse
          cx="19.7"
          cy="11.2"
          rx="0.7"
          ry="1.8"
          fill="#FFFFFF"
          fillOpacity="0.45"
          transform="rotate(-4 19.7 11.2)"
        />

        {/* Middle (Tallest) */}
        <rect
          x="20.6"
          y="7.5"
          width="2.6"
          height="9.8"
          rx="1.3"
          fill={`url(#${id}-handR)`}
          transform="rotate(2 21.9 12.4)"
        />
        <ellipse
          cx="22.1"
          cy="9.8"
          rx="0.8"
          ry="2.2"
          fill="#FFFFFF"
          fillOpacity="0.5"
          transform="rotate(2 22.1 9.8)"
        />

        {/* Ring */}
        <rect
          x="23.1"
          y="8.8"
          width="2.5"
          height="8.5"
          rx="1.25"
          fill={`url(#${id}-handR)`}
          transform="rotate(8 24.4 13)"
        />
        <ellipse
          cx="24.6"
          cy="10.8"
          rx="0.7"
          ry="1.8"
          fill="#FFFFFF"
          fillOpacity="0.45"
          transform="rotate(8 24.6 10.8)"
        />

        {/* Pinky */}
        <rect
          x="25.4"
          y="11.5"
          width="2.4"
          height="6.5"
          rx="1.2"
          fill={`url(#${id}-handR)`}
          transform="rotate(14 26.6 14.7)"
        />
        <ellipse
          cx="26.8"
          cy="13"
          rx="0.7"
          ry="1.4"
          fill="#FFFFFF"
          fillOpacity="0.45"
          transform="rotate(14 26.8 13)"
        />

        {/* Sleek Wrist Base */}
        <rect
          x="20.5"
          y="25"
          width="4.5"
          height="2"
          rx="1"
          fill="#38BDF8"
          fillOpacity="0.7"
        />
      </g>
    </svg>
  );
}

/**
 * 3D Sales Icon
 * Dimensional shopping cart with rising revenue arrow and gloss facet.
 */
export function Icon3dSales({ size = 32, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="3"
          y1="3"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>
        <linearGradient
          id={`${id}-arrow`}
          x1="12"
          y1="18"
          x2="24"
          y2="6"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#059669"
            floodOpacity="0.35"
          />
        </filter>
      </defs>
      {/* Base 3D Squircle */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        fill={`url(#${id}-bg)`}
        filter={`url(#${id}-glow)`}
      />
      {/* Gloss Highlight Edge */}
      <path
        d="M3 11C3 6.58172 6.58172 3 11 3H21C25.4183 3 29 6.58172 29 11V13C29 13 22 10 16 10C10 10 3 13 3 13V11Z"
        fill="#FFFFFF"
        fillOpacity="0.3"
      />
      {/* Shopping Cart Body */}
      <path
        d="M8 9H10.5L12 18H22L24 11H12"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cart Wheels */}
      <circle cx="13.5" cy="21.5" r="1.5" fill="#FFFFFF" />
      <circle cx="20.5" cy="21.5" r="1.5" fill="#FFFFFF" />
      {/* Rising Trend Indicator Arrow */}
      <path
        d="M17 14L22 9M22 9H18.5M22 9V12.5"
        stroke={`url(#${id}-arrow)`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 3D Finance Icon
 * Neoclassical bank treasury vault with pillars, pediment, and golden coin crest.
 */
export function Icon3dFinance({ size = 32, className, ...props }: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="3"
          y1="3"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient
          id={`${id}-gold`}
          x1="8"
          y1="8"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#1E40AF"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      {/* Base 3D Squircle */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        fill={`url(#${id}-bg)`}
        filter={`url(#${id}-glow)`}
      />
      {/* Gloss Highlight */}
      <path
        d="M3 11C3 6.58172 6.58172 3 11 3H21C25.4183 3 29 6.58172 29 11V13C29 13 22 10 16 10C10 10 3 13 3 13V11Z"
        fill="#FFFFFF"
        fillOpacity="0.3"
      />
      {/* Bank Triangular Pediment Roof */}
      <path d="M7 12L16 7L25 12H7Z" fill={`url(#${id}-gold)`} />
      {/* Bank Pillars */}
      <rect x="8.5" y="13.5" width="2.5" height="7.5" rx="1" fill="#FFFFFF" />
      <rect x="14.75" y="13.5" width="2.5" height="7.5" rx="1" fill="#FFFFFF" />
      <rect x="21" y="13.5" width="2.5" height="7.5" rx="1" fill="#FFFFFF" />
      {/* Bank Base Podium */}
      <rect
        x="6.5"
        y="21.5"
        width="19"
        height="2.5"
        rx="1"
        fill={`url(#${id}-gold)`}
      />
      {/* Mini Central Currency Dot */}
      <circle cx="16" cy="10" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 3D Purchases Icon
 * Procurement shopping bag with receipt badge and dimensional tag.
 */
export function Icon3dPurchases({
  size = 32,
  className,
  ...props
}: Icon3DProps) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="3"
          y1="3"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="50%" stopColor="#0891B2" />
          <stop offset="100%" stopColor="#164E63" />
        </linearGradient>
        <linearGradient
          id={`${id}-tag`}
          x1="16"
          y1="14"
          x2="25"
          y2="23"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#0891B2"
            floodOpacity="0.35"
          />
        </filter>
      </defs>
      {/* Base 3D Squircle */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        fill={`url(#${id}-bg)`}
        filter={`url(#${id}-glow)`}
      />
      {/* Gloss Highlight */}
      <path
        d="M3 11C3 6.58172 6.58172 3 11 3H21C25.4183 3 29 6.58172 29 11V13C29 13 22 10 16 10C10 10 3 13 3 13V11Z"
        fill="#FFFFFF"
        fillOpacity="0.3"
      />
      {/* Shopping Bag Handle */}
      <path
        d="M12 11V9C12 7.34315 13.3431 6 15 6H17C18.6569 6 20 7.34315 20 9V11"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Shopping Bag Body */}
      <rect
        x="8.5"
        y="11"
        width="15"
        height="12"
        rx="2.5"
        fill="#FFFFFF"
        fillOpacity="0.95"
      />
      {/* Receipt Lines on Bag */}
      <rect x="11.5" y="14" width="9" height="1.5" rx="0.75" fill="#0891B2" />
      <rect x="11.5" y="17" width="6" height="1.5" rx="0.75" fill="#0891B2" />
      {/* Discount Tag Badge */}
      <circle
        cx="21"
        cy="20.5"
        r="3.5"
        fill={`url(#${id}-tag)`}
        stroke="#FFFFFF"
        strokeWidth="1"
      />
      <circle cx="21" cy="20.5" r="1" fill="#FFFFFF" />
    </svg>
  );
}
