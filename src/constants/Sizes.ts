/**
 * Design token constants for Bylit.
 * All font sizes, icon sizes, button/container sizes, and border radii
 * should be sourced from here for a uniform look across all screens.
 */

/** Font sizes */
export const FONT = {
    /** Screen titles, hero text */
    h1: 24,
    /** Section / card headers */
    h2: 20,
    /** Sub-headers inside cards */
    h3: 16,
    /** Primary body copy */
    body: 14,
    /** Secondary / supporting text */
    sm: 12,
    /** Labels, badges, chips */
    xs: 10,
    /** Micro-labels, uppercase tags */
    xxs: 9,
    /** Smallest readable text */
    tiny: 8,
} as const;

/** Icon sizes (passed directly to lucide-react-native `size` prop) */
export const ICON = {
    /** Inline / badge icons */
    sm: 14,
    /** List row icons */
    md: 18,
    /** Card icons / tab bar */
    lg: 22,
    /** Hero / FAB icons */
    xl: 28,
    /** Extra large (e.g. empty states) */
    xxl: 36,
} as const;

/** Square icon-button / container dimensions */
export const BTN = {
    /** Small action chip (e.g. save check in time picker) */
    sm: { width: 30, height: 30, borderRadius: 10 },
    /** Standard header action button */
    md: { width: 38, height: 38, borderRadius: 12 },
    /** Large header / primary action */
    lg: { width: 44, height: 44, borderRadius: 14 },
    /** Floating action button */
    fab: { width: 56, height: 56, borderRadius: 20 },
    /** Wide icon box in settings rows */
    iconBox: { width: 32, height: 32, borderRadius: 10 },
} as const;

/** Shared border radii */
export const RADIUS = {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 24,
    xxl: 28,
    pill: 100,
} as const;
