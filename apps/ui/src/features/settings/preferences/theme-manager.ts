/**
 * Centralized DOM and LocalStorage synchronization for TexaWave ERP theme and density.
 * Guarantees that document.documentElement and browser storage stay in sync with
 * backend preferences and immediate user actions.
 */

export type ThemeMode = "light" | "dark" | "system";
export type DensityMode = "compact" | "comfortable" | "spacious";

export const STORAGE_KEY_THEME = "texawave_theme";
export const STORAGE_KEY_PORTAL_THEME = "texawave_portal_theme";
export const STORAGE_KEY_DENSITY = "texawave_density";

/**
 * Generates an isolated storage key for employee portal theme preferences.
 */
export function getPortalThemeStorageKey(userId?: number | null): string {
  return userId ? `texawave_portal_theme_${userId}` : STORAGE_KEY_PORTAL_THEME;
}

/**
 * Resolves whether a theme mode evaluates to dark mode given current system environment.
 */
export function resolveIsDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

/**
 * Retrieves the stored portal theme preference from localStorage, if any.
 */
export function getStoredPortalTheme(
  userId?: number | null,
): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  try {
    if (userId) {
      const userVal = localStorage.getItem(`texawave_portal_theme_${userId}`);
      if (userVal === "light" || userVal === "dark") {
        return userVal;
      }
    }
    const val = localStorage.getItem(STORAGE_KEY_PORTAL_THEME);
    if (val === "light" || val === "dark") {
      return val;
    }
  } catch {
    // Ignore private browsing / quota errors
  }
  return null;
}

/**
 * Retrieves the stored theme preference from localStorage, if any.
 */
export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const val =
      localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem("theme");
    if (val === "light" || val === "dark" || val === "system") {
      return val as ThemeMode;
    }
  } catch {
    // Ignore private browsing / quota errors
  }
  return null;
}

/**
 * Retrieves the stored density preference from localStorage, if any.
 */
export function getStoredDensity(): DensityMode | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(STORAGE_KEY_DENSITY);
    if (val === "compact" || val === "comfortable" || val === "spacious") {
      return val as DensityMode;
    }
  } catch {
    // Ignore private browsing / quota errors
  }
  return null;
}

let systemThemeListenerAttached = false;

export function initSystemThemeListener(): void {
  if (
    typeof window === "undefined" ||
    !window.matchMedia ||
    systemThemeListenerAttached
  )
    return;
  systemThemeListenerAttached = true;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemChange = (e: MediaQueryListEvent | MediaQueryList) => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname || "";
      const isPortal =
        path.startsWith("/portal") ||
        path.startsWith("/onboarding") ||
        path.startsWith("/self-service");
      if (isPortal) {
        return;
      }
    }
    const currentTheme = getStoredTheme();
    if (currentTheme === "system") {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  try {
    if (media.addEventListener) {
      media.addEventListener("change", handleSystemChange);
    } else if ("addListener" in media) {
      (
        media as unknown as {
          addListener: (cb: (e: MediaQueryList) => void) => void;
        }
      ).addListener(handleSystemChange);
    }
  } catch {
    // Ignore media query listener exceptions
  }
}

/**
 * Immediately applies the chosen main ERP theme to document.documentElement and local storage.
 * Does not touch portal theme settings.
 */
export function applyThemeToDom(theme: ThemeMode): void {
  if (typeof window === "undefined") return;

  initSystemThemeListener();

  const isDark = resolveIsDark(theme);
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    // Also keep legacy 'theme' key updated for backwards compatibility
    localStorage.setItem("theme", isDark ? "dark" : "light");
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Ignore local storage quota/private-browsing exceptions
  }
}

/**
 * Immediately applies the employee portal theme to document.documentElement and local storage.
 * Isolated from main ERP theme settings (does not touch texawave_theme).
 */
export function applyPortalThemeToDom(
  theme: "light" | "dark",
  userId?: number | null,
): void {
  if (typeof window === "undefined") return;

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  try {
    if (userId) {
      localStorage.setItem(`texawave_portal_theme_${userId}`, theme);
    }
    localStorage.setItem(STORAGE_KEY_PORTAL_THEME, theme);
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Ignore local storage quota/private-browsing exceptions
  }
}

/**
 * Immediately applies UI density to document.documentElement and local storage.
 */
export function applyDensityToDom(density: DensityMode): void {
  if (typeof window === "undefined") return;

  document.documentElement.setAttribute("data-density", density);

  try {
    localStorage.setItem(STORAGE_KEY_DENSITY, density);
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Ignore local storage quota/private-browsing exceptions
  }
}
