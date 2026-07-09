// Anti-flash de tema: setea data-theme en <html> antes de que React monte,
// para evitar el flash de tema claro/oscuro. Debe ejecutarse antes del primer
// paint (se carga como script externo sin defer/async en el <head>). Externo
// —no inline— para cumplir el CSP script-src 'self' sin unsafe-inline.
(function () {
  var saved = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = saved === 'dark' || ((saved === 'system' || !saved) && prefersDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
