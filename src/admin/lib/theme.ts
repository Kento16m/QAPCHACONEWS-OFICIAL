export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const KEY = "qap_admin_theme";

export const resolveTheme = (saved: ThemeChoice | null, systemDark: boolean): Theme => {
  if (saved === "light" || saved === "dark") return saved;
  return systemDark ? "dark" : "light";
};

export const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export const saveTheme = (theme: Theme) => {
  localStorage.setItem(KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
};
