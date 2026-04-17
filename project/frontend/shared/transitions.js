
// Fade in al cargar
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
});

// Fade out al salir
document.querySelectorAll('a[href]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    // Ignorar links externos, anclas o javascript:
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript')) return;

    e.preventDefault();
    document.body.classList.remove('loaded');
    setTimeout(() => {
      window.location.href = href;
    }, 200); // mismo tiempo que la transición
  });
});