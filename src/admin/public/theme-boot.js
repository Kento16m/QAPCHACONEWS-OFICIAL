// Runs before the first paint so a dark-mode user never sees a white flash.
// Same rule as resolveTheme in lib/theme.ts. A separate file because the CSP forbids inline scripts.
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem("qap_admin_theme");
  } catch (_) {}
  var dark =
    saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();
