(function() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  let theme = 'light';
  if (saved) {
    theme = saved;
  } else if (prefersDark) {
    theme = 'dark';
  }
  
  document.documentElement.dataset.theme = theme;
})();