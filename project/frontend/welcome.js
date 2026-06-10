(function() {
    const salirBtn = document.getElementById('btnSalir');
    const entrarBtn = document.getElementById('btnEntrar');

    // Función para overlay dramático y luego redirigir
    function redirigirConOverlay(urlDestino, esSalida = false) {
      // Prevenir múltiples clics
      if (window._redirecting) return;
      window._redirecting = true;

      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'black';
      overlay.style.zIndex = '9999';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      overlay.style.pointerEvents = 'none';
      document.body.appendChild(overlay);
      
      // Forzar reflow para que la transición funcione
      setTimeout(() => { overlay.style.opacity = '0.95'; }, 10);
      
      // Redirigir después del efecto visual
      setTimeout(() => {
        if (esSalida) {
          // Para salir usamos replace para que no quede esta página en el historial
          window.location.replace(urlDestino);
        } else {
          window.location.href = urlDestino;
        }
        // Intento de cerrar ventana (solo funciona en algunos contextos)
        try { window.close(); } catch(e) { /* silencioso */ }
      }, 380);
    }

    if (entrarBtn) {
      entrarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Redirige a la raíz del sitio (el índice del foro)
        redirigirConOverlay('/', false);
      });
    }

    if (salirBtn) {
      salirBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Redirige a Google con la búsqueda "i'm pussy" (exactamente como lo pediste)
        const googleUrl = 'https://www.google.com/search?q=i%27m+pussy&sxsrf=ANbL-n4CD6eFZieRrQrcI6ACtrC7HgCU8w%3A1780172388495';
        redirigirConOverlay(googleUrl, true);
      });
    }

    // Efecto de parpadeo en el badge (solo estético)
    let blinkState = false;
    setInterval(() => {
      const warnBadge = document.querySelector('.warning-glow');
      if (warnBadge) {
        warnBadge.style.opacity = blinkState ? '0.9' : '1';
        blinkState = !blinkState;
      }
    }, 700);
  })();