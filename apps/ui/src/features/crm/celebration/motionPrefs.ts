// CRM Core Domain — shared `prefers-reduced-motion` check, used by every celebration effect
// (confetti, balloons, bunting) so a single source of truth decides whether motion plays at all.
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
