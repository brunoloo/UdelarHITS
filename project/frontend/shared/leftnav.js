document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificamos si el usuario es admin antes de renderizar el nav
  let isAdmin = false;
  try {
    const meResult = await apiGet("/users/me");
    isAdmin = (meResult.ok && meResult.data?.user?.rol === 'admin');
  } catch (error) {
    console.error("Error verificando permisos:", error);
  }

  const nav = document.createElement('nav');
  nav.className = 'left-nav';
  
  // 2. Construimos el HTML e insertamos "Desarrollo" condicionalmente
  nav.innerHTML = `
    <a href="/" class="nav-item" id="nav-inicio">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
      Inicio
    </a>

    <a href="/src/explore/explore.html" class="nav-item" id="nav-explorar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      Explorar
    </a>

    <a href="#" class="nav-item" id="nav-notifications">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
      Notificaciones
    </a>

    <a href="#" class="nav-item" id="nav-chat">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      Chat
    </a>
    
    <div class="nav-divider"></div>

    <a href="/src/popular/popular.html" class="nav-item" id="nav-populares">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      Populares
    </a>

    <a href="/src/recent/recent.html" class="nav-item" id="nav-recientes">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Recientes
    </a>

    ${isAdmin ? `
    <div class="nav-divider"></div>

    <a href="/testing.html" class="nav-item" id="nav-dev">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 3h6"/>
        <path d="M10 3v5l-5.5 9.5A2 2 0 0 0 6 20h12a2 2 0 0 0 1.5-3.5L14 8V3"/>
        <path d="M8 16h8"/>
      </svg>
      Desarrollo
    </a>
    ` : ''}

    <a href="/src/about/about.html" class="nav-item" id="nav-about">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Quienes somos
    </a>

    <a href="/src/configuration/configuration.html" class="nav-item nav-item-bottom" id="nav-configuration">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Configuración
    </a>

  `;

  // Marcar item activo según la página actual
  const path = window.location.pathname;
  if (path === '/' || path.includes('index')) {
    nav.querySelector('#nav-inicio')?.classList.add('active');
  } else if (path.includes('explore')) {
    nav.querySelector('#nav-explorar')?.classList.add('active');
  } else if (path.includes('popular')) {
    nav.querySelector('#nav-populares')?.classList.add('active');
  } else if (path.includes('recent')) {
    nav.querySelector('#nav-recientes')?.classList.add('active');
  } else if (path.includes('testing') && isAdmin) { // Agregado para resaltar Desarrollo
    nav.querySelector('#nav-dev')?.classList.add('active');
  } else if (path.includes('about')) {
    nav.querySelector('#nav-about')?.classList.add('active');
  } else if (path.includes('configuration')) {
    nav.querySelector('#nav-configuration')?.classList.add('active');
  }

  document.body.appendChild(nav);
});