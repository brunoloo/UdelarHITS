document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".settings-tab");
  const sections = document.querySelectorAll(".settings-section");

  function activate(tabId) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
    sections.forEach(s => s.classList.toggle("active", s.id === tabId));
  }

  // inicial
  const hash = window.location.hash?.replace("#", "");
  activate(hash || "apariencia");

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const id = tab.dataset.tab;
      history.replaceState(null, "", `#${id}`);
      activate(id);
    });
  });
});

// ── Selector de tema ───────────────────────────────────
const themeRadios = document.querySelectorAll('input[name="theme"]');

// Marcar el radio correcto al cargar
function syncThemeSelector() {
  const saved = localStorage.getItem('theme');
  const value = saved || 'system';  
  
  themeRadios.forEach(radio => {
    radio.checked = (radio.value === value);
  });
}

syncThemeSelector();

// Escuchar cambios
themeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'system') {
      window.clearTheme();
    } else {
      window.setTheme(radio.value);
    }
  });
});