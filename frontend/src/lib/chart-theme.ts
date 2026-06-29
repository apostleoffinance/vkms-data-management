"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";

import { BRAND } from "@/lib/brand";

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return useMemo(
    () => ({
      line: isDark ? BRAND.yellow : BRAND.black,
      lineDot: isDark ? BRAND.yellow : BRAND.black,
      activeDot: isDark ? "#ffffff" : BRAND.yellow,
      barPrimary: BRAND.yellow,
      barSecondary: isDark ? "#a3a3a3" : BRAND.black,
      grid: isDark ? "#404040" : "#e5e5e5",
      tick: isDark ? "#a3a3a3" : "#525252",
    }),
    [isDark],
  );
}
