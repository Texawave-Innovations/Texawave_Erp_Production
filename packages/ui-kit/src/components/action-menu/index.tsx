"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { cn } from "../../lib/cn";

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | undefined;
  icon?: ReactNode | undefined;
  disabled?: boolean | undefined;
  separator?: boolean | undefined;
  href?: string | undefined;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel: string;
  triggerIcon?: "vertical" | "horizontal" | undefined;
  buttonClassName?: string | undefined;
  className?: string | undefined;
  menuClassName?: string | undefined;
}

function MoreVerticalIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MoreHorizontalIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DefaultActionIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const pointOnCircle = (i: number, n: number, r: number, cx = 0, cy = 0) => {
  const theta = (2 * Math.PI * i) / n - Math.PI / 2;
  const x = cx + r * Math.cos(theta);
  const y = cy + r * Math.sin(theta);
  return { x, y };
};

/**
 * Computes tooltip position radially outward from the center (0, 0),
 * while intelligently checking viewport screen boundaries (screenX, screenY)
 * so descriptions never overflow beyond the window margins.
 */
function getTooltipPlacement(
  x: number,
  y: number,
  screenX?: number,
  screenY?: number,
): string {
  const winWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const winHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  const itemX = screenX ?? 0;
  const itemY = screenY ?? 0;

  const isNearRightEdge = itemX > winWidth - 140;
  const isNearLeftEdge = itemX < 140;
  const isNearTopEdge = itemY < 70;
  const isNearBottomEdge = itemY > winHeight - 70;

  // If item is near the right boundary of the viewport, force tooltip inward/leftward
  if (isNearRightEdge) {
    if (Math.abs(y) > Math.abs(x) * 1.5) {
      return y <= 0 ? "bottom-full mb-2 right-0" : "top-full mt-2 right-0";
    }
    return "right-full mr-2 top-1/2 -translate-y-1/2";
  }

  // If item is near the left boundary of the viewport, force tooltip to the right
  if (isNearLeftEdge) {
    if (Math.abs(y) > Math.abs(x) * 1.5) {
      return y <= 0 ? "bottom-full mb-2 left-0" : "top-full mt-2 left-0";
    }
    return "left-full ml-2 top-1/2 -translate-y-1/2";
  }

  // If near top or bottom edges
  if (isNearTopEdge) {
    return x <= 0 ? "right-full mr-2 top-0" : "left-full ml-2 top-0";
  }

  if (isNearBottomEdge) {
    return x <= 0 ? "right-full mr-2 bottom-0" : "left-full ml-2 bottom-0";
  }

  // Default radial outward logic
  if (Math.abs(y) >= Math.abs(x)) {
    return y <= 0
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : "top-full mt-2 left-1/2 -translate-x-1/2";
  }
  return x <= 0
    ? "right-full mr-2 top-1/2 -translate-y-1/2"
    : "left-full ml-2 top-1/2 -translate-y-1/2";
}

const CONSTANTS = {
  itemSize: 42,
  triggerSize: 36,
  openStagger: 0.03,
  closeStagger: 0.05,
};

/**
 * Universal Circular Radial ActionMenu component.
 * Reusable across the entire TexaOne ERP application.
 *
 * Architecture Highlights:
 * 1. Compact in-flow resting footprint (h-8 w-8 or custom buttonClassName) that fits
 *    seamlessly in table rows, cards, or headers without stretching heights or underfitting.
 * 2. When activated, mounts a Portal directly into document.body at z-[9999] so it is
 *    100% immune to table overflow:hidden, card clipping, and scroll-container masking.
 * 3. Dynamically clamps its radial coordinates to viewport boundaries, guaranteeing
 *    that items never overflow off-screen even on the extreme edges of data tables.
 * 4. Rich framer-motion spring physics, rotational morphing, and accessible keyboard escape dismissal.
 */
export function ActionMenu({
  items,
  ariaLabel,
  triggerIcon = "vertical",
  buttonClassName,
  className,
  menuClassName,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const rotateAnim = useAnimationControls();
  const shakeAnim = useAnimationControls();

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const radius = items.length <= 3 ? 62 : items.length <= 5 ? 74 : 86;
    const padding = radius + 48;

    const tx = rect.left + rect.width / 2;
    const ty = rect.top + rect.height / 2;

    const clampedX = Math.max(
      padding,
      Math.min(window.innerWidth - padding, tx),
    );
    const clampedY = Math.max(
      padding,
      Math.min(window.innerHeight - padding, ty),
    );

    setCoords({ x: clampedX, y: clampedY });
  }, [items.length]);

  const handleOpen = () => {
    calculatePosition();
    setIsOpen(true);
  };

  const closeAnimation = async () => {
    await rotateAnim.start({
      rotate: -360,
      filter: "blur(0.5px)",
      transition: {
        duration: CONSTANTS.closeStagger * (items.length + 1),
        ease: "linear",
      },
    });
    await rotateAnim.start({
      rotate: 0,
      filter: "blur(0px)",
      transition: { duration: 0 },
    });
  };

  const handleClose = async () => {
    await closeAnimation();
    setIsOpen(false);
    setHoveredIndex(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
        triggerRef.current?.focus();
      }
    }

    function handleScrollOrResize() {
      calculatePosition();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, calculatePosition]);

  const radius = items.length <= 3 ? 62 : items.length <= 5 ? 74 : 86;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      {/* Resting trigger button in the normal layout flow */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={isOpen ? handleClose : handleOpen}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-500/10 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors cursor-pointer",
          buttonClassName,
        )}
      >
        {triggerIcon === "horizontal" ? (
          <MoreHorizontalIcon className="h-4 w-4" />
        ) : (
          <MoreVerticalIcon className="h-4 w-4" />
        )}
      </button>

      {/* Floating radial circular menu rendered at top-level body via Portal */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 isolate"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
          >
            {/* Subtle dismissible backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleClose}
              className="fixed inset-0 bg-slate-950/20 backdrop-blur-[1px] dark:bg-black/40"
            />

            {/* Radial circular menu container */}
            <div
              style={{
                position: "fixed",
                left: coords.x,
                top: coords.y,
                transform: "translate(-50%, -50%)",
                width: radius * 2 + 64,
                height: radius * 2 + 64,
              }}
              className={cn(
                "pointer-events-none flex items-center justify-center",
                menuClassName,
              )}
            >
              {/* Center Morphing Trigger Button */}
              <motion.div
                animate={shakeAnim}
                className="pointer-events-auto z-30"
              >
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  aria-label="Close menu"
                  style={{
                    height: CONSTANTS.triggerSize,
                    width: CONSTANTS.triggerSize,
                  }}
                  className="flex items-center justify-center rounded-full bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-lg ring-2 ring-white/80 hover:brightness-110 dark:ring-gray-800 focus:outline-none cursor-pointer"
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key="close"
                      initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <CloseIcon className="h-4 w-4" />
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </motion.div>

              {/* Radial Items Orbiting the Center */}
              <motion.div
                animate={rotateAnim}
                className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
              >
                {items.map((item, index) => {
                  const { x, y } = pointOnCircle(index, items.length, radius);
                  const isHovered = hoveredIndex === index;

                  const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (item.disabled) return;
                    handleClose();
                    item.onClick();
                  };

                  return (
                    <div
                      key={`${item.label}-${index}`}
                      className={cn(
                        "absolute flex items-center justify-center pointer-events-auto",
                        isHovered ? "z-50" : "z-20",
                      )}
                    >
                      <motion.button
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                        animate={{
                          x,
                          y,
                          opacity: item.disabled ? 0.45 : 1,
                          scale: 1,
                        }}
                        exit={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                        whileHover={
                          !item.disabled
                            ? {
                                scale: 1.15,
                                transition: { duration: 0.1 },
                              }
                            : {}
                        }
                        transition={{
                          delay: index * CONSTANTS.openStagger,
                          type: "spring",
                          stiffness: 340,
                          damping: 24,
                        }}
                        style={{
                          height: CONSTANTS.itemSize,
                          width: CONSTANTS.itemSize,
                        }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={handleClick}
                        className={cn(
                          "relative flex items-center justify-center rounded-full shadow-md transition-colors cursor-pointer",
                          item.variant === "destructive"
                            ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-900 dark:hover:bg-rose-600 dark:hover:text-white"
                            : "bg-white text-slate-700 border border-slate-200/90 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white",
                          item.disabled && "cursor-not-allowed opacity-40",
                        )}
                        aria-label={item.label}
                      >
                        <span className="flex items-center justify-center text-sm">
                          {item.icon ?? (
                            <DefaultActionIcon className="h-4 w-4" />
                          )}
                        </span>

                        {/* Floating tooltip label appearing on hover - radially placed outward to prevent underflowing or colliding with the center X icon */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.88 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.88 }}
                              transition={{ duration: 0.12 }}
                              className={cn(
                                "pointer-events-none absolute whitespace-nowrap rounded-md bg-slate-900/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl ring-1 ring-white/10 dark:bg-gray-900 dark:ring-white/20 dark:text-gray-100 z-50 max-w-50 truncate",
                                getTooltipPlacement(
                                  x,
                                  y,
                                  coords.x + x,
                                  coords.y + y,
                                ),
                              )}
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>,
          (triggerRef.current?.closest("dialog") as HTMLElement | null) ??
            document.body,
        )}
    </div>
  );
}
