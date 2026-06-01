 // Función para botón SALIR: Simula "huida" con efecto dramático y cierra o redirige a sitio amigable
  const salirBtn = document.getElementById('btnSalir');
  const entrarBtn = document.getElementById('btnEntrar'); 
  
  if (entrarBtn) {
    entrarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Creamos un efecto de "alerta" de salida, como si se escapara del gateway
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
      
      setTimeout(() => { overlay.style.opacity = '0.92'; }, 10);
      
      setTimeout(() => {
        window.location.replace("/");
        try { window.close(); } catch(e) { /* no pasa nada */ }
      }, 380);
    });
  }

  if (salirBtn) {
    salirBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // efecto de salida
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
      
      setTimeout(() => { overlay.style.opacity = '0.92'; }, 10);
      
      setTimeout(() => {
        window.location.replace('https://www.google.com/search?q=i%27m+pussy&sxsrf=ANbL-n4CD6eFZieRrQrcI6ACtrC7HgCU8w%3A1780172388495');
        try { window.close(); } catch(e) { /* no pasa nada */ }
      }, 380);
    });
  }

  // Efecto de parpadeo en el título (solo estético)
  let blinkState = false;
  setInterval(() => {
    const warnBadge = document.querySelector('.warning-glow');
    if (warnBadge) {
      warnBadge.style.opacity = blinkState ? '0.9' : '1';
      blinkState = !blinkState;
    }
  }, 700);