"use client";

import { useState, useTransition } from "react";

import { ThemeMode } from "@/lib/preferences";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

type ThemeToggleProps = {
  initialThemeMode: ThemeMode;
};

export function ThemeToggle({ initialThemeMode }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialThemeMode);
  const [pending, startTransition] = useTransition();

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    startTransition(async () => {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          themeMode: nextTheme
        })
      });
    });
  }

  return (
    <button className="button button-secondary theme-toggle" disabled={pending} onClick={toggleTheme} type="button">
      {theme === "dark" ? "Switch to light" : "Switch to dark"}
    </button>
  );
}
