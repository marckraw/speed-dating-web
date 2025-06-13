"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createContext, useContext, useState, useEffect } from "react";

type ThemeVariation = "default" | "pink" | "sage";

interface ThemeContextType {
  themeVariation: ThemeVariation;
  setThemeVariation: (variation: ThemeVariation) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeVariation() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeVariation must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeVariation, setThemeVariation] =
    useState<ThemeVariation>("default");

  // Apply theme variation classes
  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove("theme-default", "theme-pink", "theme-sage");
    // Don't add theme-default class as it's handled by :root
    if (themeVariation !== "default") {
      root.classList.add(`theme-${themeVariation}`);
    }
  }, [themeVariation]);

  return (
    <ThemeContext.Provider value={{ themeVariation, setThemeVariation }}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </ThemeContext.Provider>
  );
}
