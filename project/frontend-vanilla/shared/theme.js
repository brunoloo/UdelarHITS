// ── Aplicar tema ────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

// ── Escuchar cambios del sistema ───────────────────────
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function handleSystemThemeChange(e) {
  const saved = localStorage.getItem('theme');
  
  // Solo reaccionar si el usuario eligió "sistema" (no hay tema guardado)
  if (!saved) {
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  }
}

mediaQuery.addEventListener('change', handleSystemThemeChange);

// ── Exponer funciones globales ─────────────────────────
window.setTheme = setTheme;

window.getTheme = function() {
  return localStorage.getItem('theme') || 
         (mediaQuery.matches ? 'dark' : 'light');
};

window.clearTheme = function() {
  localStorage.removeItem('theme');
  const prefersDark = mediaQuery.matches;
  document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
};