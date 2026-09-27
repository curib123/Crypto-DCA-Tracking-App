(() => {
  const key = "nextfi-preview-theme";
  const root = document.documentElement;
  const saved = localStorage.getItem(key) || "system";

  function apply(mode) {
    const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.classList.toggle("active", button.dataset.themeChoice === mode);
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-choice]");
    if (!button) return;
    const mode = button.dataset.themeChoice;
    localStorage.setItem(key, mode);
    apply(mode);
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem(key) || "system") === "system") apply("system");
  });

  document.addEventListener("DOMContentLoaded", () => apply(saved));
})();