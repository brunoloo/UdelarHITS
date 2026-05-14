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