// ── Left Nav + Panel de Notificaciones ──

// Formateador de tiempo mínimo (no depende de timeAgo.js que no está en todas las páginas)
function notifTimeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(dateStr).toLocaleDateString('es-UY');
}

document.addEventListener('DOMContentLoaded', async () => {

  // ── 1. Verificar si el usuario es admin ──
  let isAdmin = false;
  let isLoggedIn = false;
  try {
    const meResult = await apiGet("/users/me");
    isAdmin = (meResult.ok && meResult.data?.user?.rol === 'admin');
    isLoggedIn = meResult.ok;
  } catch (error) {
    console.error("Error verificando permisos:", error);
  }

  // ── 2. Construir el nav ──
  const nav = document.createElement('nav');
  nav.className = 'left-nav';

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
      <span class="notif-badge" id="notifBadge"></span>
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

  // ── 3. Marcar item activo ──
  const path = window.location.pathname;
  if (path === '/' || path.includes('index')) {
    nav.querySelector('#nav-inicio')?.classList.add('active');
  } else if (path.includes('explore')) {
    nav.querySelector('#nav-explorar')?.classList.add('active');
  } else if (path.includes('popular')) {
    nav.querySelector('#nav-populares')?.classList.add('active');
  } else if (path.includes('recent')) {
    nav.querySelector('#nav-recientes')?.classList.add('active');
  } else if (path.includes('testing') && isAdmin) {
    nav.querySelector('#nav-dev')?.classList.add('active');
  } else if (path.includes('about')) {
    nav.querySelector('#nav-about')?.classList.add('active');
  } else if (path.includes('configuration')) {
    nav.querySelector('#nav-configuration')?.classList.add('active');
  }

  document.body.appendChild(nav);

  // ── 4. Panel de notificaciones ──
  const navWidth = nav.offsetWidth;
  document.documentElement.style.setProperty('--nav-w', navWidth + 'px');

  const panel = document.createElement('div');
  panel.className = 'notif-panel';
  panel.id = 'notifPanel';
  panel.innerHTML = `
    <div class="notif-panel-head">
      <h3>Notificaciones</h3>
      <button class="notif-panel-close" id="closeNotifPanel" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="notif-panel-body" id="notifPanelBody">
      <div class="notif-empty">No tenés notificaciones</div>
    </div>
  `;
  document.body.appendChild(panel);

  const badge = document.getElementById('notifBadge');
  const navNotifBtn = document.getElementById('nav-notifications');
  const panelBody = document.getElementById('notifPanelBody');
  let panelOpen = false;

  // ── Badge: cargar conteo al inicio ──
  async function loadBadge() {
    if (!isLoggedIn) return;
    try {
      const res = await apiGet('/notifications/unread-count');
      if (res.ok && res.data.total > 0) {
        badge.textContent = res.data.total > 99 ? '99+' : res.data.total;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch (e) {
      badge.style.display = 'none';
    }
  }
  loadBadge();

  // ── Toggle del panel ──
  navNotifBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (panelOpen) {
      closePanel();
      return;
    }

    openPanel();
  });

  async function openPanel() {
    panel.classList.add('open');
    panelOpen = true;
    navNotifBtn.classList.add('active');

    if (!isLoggedIn) {
      panelBody.innerHTML = `
        <div class="notif-empty">
          <p>Iniciá sesión para ver tus notificaciones</p>
        </div>
      `;
      return;
    }

    panelBody.innerHTML = `<div class="notif-loading">Cargando...</div>`;

    try {
      const res = await apiGet('/notifications');
      const notifs = res.ok ? res.data : [];

      if (notifs.length === 0) {
        panelBody.innerHTML = `<div class="notif-empty">No tenés notificaciones</div>`;
      } else {
        renderNotifications(notifs);
      }

      await apiPatch('/notifications/read-all');
      badge.style.display = 'none';
    } catch (e) {
      panelBody.innerHTML = `<div class="notif-empty">Error al cargar notificaciones</div>`;
    }
  }

  function closePanel() {
    panel.classList.remove('open');
    panelOpen = false;
    navNotifBtn.classList.remove('active');
  }

  // Cerrar con X
  document.getElementById('closeNotifPanel').addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });

  // Cerrar al clickear fuera del panel y del nav item
  document.addEventListener('click', (e) => {
    if (!panelOpen) return;
    if (panel.contains(e.target) || navNotifBtn.contains(e.target)) return;
    closePanel();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) closePanel();
  });

  // ── Renderizar notificaciones ──
  function renderNotifications(notifs) {
    panelBody.innerHTML = notifs.map(n => {
      const isMod = n.tipo === 'moderacion_contenido';
      const linkHtml = isMod
      ? `<a href="/src-central/moderation/moderation-info.html?tipo=${n.mensaje.includes('categoría') ? 'categoria' : n.mensaje.includes('tema') ? 'tema' : 'comentario'}" class="notif-link" target="_blank">Leer más</a>`
      : '';

      const iconSvg = isMod
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>`;

      return `
        <div class="notif-item" data-notif-id="${n.id}">
          <div class="notif-icon">${iconSvg}</div>
          <div class="notif-content">
            <p class="notif-message">${escapeHtml(n.mensaje)}</p>
            ${linkHtml}
            <span class="notif-time">${notifTimeAgo(n.fecha_creacion)}</span>
          </div>
          <button class="notif-delete" data-notif-id="${n.id}" type="button" title="Eliminar notificación">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
    }).join('');

    // Event delegation para eliminar notificaciones
    panelBody.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.notif-delete');
      if (!deleteBtn) return;
      e.stopPropagation();

      const notifId = deleteBtn.dataset.notifId;
      const item = deleteBtn.closest('.notif-item');

      const result = await apiDelete(`/notifications/${notifId}`);
      if (result.ok) {
        item.style.transition = 'opacity 0.2s';
        item.style.opacity = '0';
        setTimeout(() => {
          item.remove();
          if (panelBody.querySelectorAll('.notif-item').length === 0) {
            panelBody.innerHTML = '<div class="notif-empty">No tenés notificaciones</div>';
          }
        }, 200);
      }
    });
  }
});