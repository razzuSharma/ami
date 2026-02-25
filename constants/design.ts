export class AppTheme {
  static colors = {
    background: "#0A1628",
    surface: "#0F2040",
    surfaceBorder: "rgba(255,255,255,0.06)",
    accentPrimary: "#5ECFB1",
    accentSecondary: "#C4A882",
    danger: "#E87070",
    textPrimary: "#F0EDE8",
    textMuted: "#7A8FA6",
    glowTeal: "rgba(94,207,177,0.35)",
    glassOverlay: "rgba(255,255,255,0.04)",
  } as const;

  static radius = {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30,
    pill: 999,
  } as const;

  static space = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  } as const;

  static fonts = {
    serifDisplay: "DMSerifDisplay_400Regular",
    bodyRegular: "DMSans_400Regular",
    bodyMedium: "DMSans_500Medium",
    bodyBold: "DMSans_700Bold",
    statItalic: "PlayfairDisplay_600SemiBold_Italic",
  } as const;
}

export const gradients = {
  appBackground: ["#0A1628", "#0B1A31", "#0A1628"] as const,
  heroMesh: ["#13365B", "#0F2040", "#0A1628"] as const,
  accent: ["#74e1c6", "#5ECFB1", "#3aa98d"] as const,
  tealAccent: ["#74e1c6", "#5ECFB1", "#3aa98d"] as const,
  goldAccent: ["#d8be9f", "#C4A882", "#a78862"] as const,
};

// Backward-compatible alias for existing screens still importing `design`.
export const design = {
  colors: {
    bgTop: AppTheme.colors.background,
    bgMid: "#0B1A31",
    bgBottom: AppTheme.colors.background,
    surface: AppTheme.colors.glassOverlay,
    surfaceStrong: "rgba(255,255,255,0.08)",
    border: AppTheme.colors.surfaceBorder,
    textPrimary: AppTheme.colors.textPrimary,
    textSecondary: AppTheme.colors.textMuted,
    accentStart: AppTheme.colors.accentPrimary,
    accentEnd: "#3aa98d",
    accentSoft: "rgba(94,207,177,0.18)",
    success: AppTheme.colors.accentPrimary,
    warning: AppTheme.colors.accentSecondary,
    danger: AppTheme.colors.danger,
    mutedInk: AppTheme.colors.textMuted,
  },
  radius: AppTheme.radius,
  space: AppTheme.space,
};
