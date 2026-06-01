async function initSidebar(options = {}) {
  const aside = document.querySelector('.sidebar');
  if (!aside) return;

  const page = options.page || 'index';

  // Verificar autenticación
  let isLoggedIn = false;
  try {
    const meRes = await apiGet('/users/me');
    isLoggedIn = meRes?.ok;
  } catch (e) {}

  let html = '';

  // Banner "Únete" para no autenticados
  if (!isLoggedIn) {
    html += `
      <div class="join-banner">
        <h3>Únete a UdelarHITS</h3>
        <p>Participa en la comunidad universitaria. Crea temas, comenta y conecta con otros estudiantes.</p>
        <a href="/src/auth/register.html" class="btn-white">Crear cuenta</a>
        <a href="/src/auth/login.html" class="btn-outline-white">Iniciar sesión</a>
      </div>
    `;
  }

  // Cards según la página
  if (page === 'index') {
    html += `
      <div class="sidebar-card">
        <div class="sidebar-card-header">Comunidad</div>
        <div class="sidebar-card-body">
          <div class="stat-row">
            <span class="stat-row-label">Categorías activas</span>
            <span class="stat-row-value" id="statCategories">—</span>
          </div>
        </div>
      </div>
    `;
  }

  if (page === 'recent') {
    // Tags trending (calculados de los datos que le pasemos)
    html += `
      <div class="sidebar-card">
        <div class="sidebar-card-header">Etiquetas populares</div>
        <div class="sidebar-card-body" id="sidebarTags">
          <div class="sidebar-loading">Cargando...</div>
        </div>
      </div>
      <div class="sidebar-card">
        <div class="sidebar-card-header">Comunidad</div>
        <div class="sidebar-card-body">
          <div class="stat-row">
            <span class="stat-row-label">Categorías activas</span>
            <span class="stat-row-value" id="statCategories">—</span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Temas recientes</span>
            <span class="stat-row-value" id="statTopics">—</span>
          </div>
        </div>
      </div>
    `;
  }

  if (page === 'popular') {
    html += `
      <div class="sidebar-card">
        <div class="sidebar-card-header">Categorías nuevas</div>
        <div class="sidebar-card-body" id="sidebarNewCats">
          <div class="sidebar-loading">Cargando...</div>
        </div>
      </div>
      <div class="sidebar-card">
        <div class="sidebar-card-header">Comunidad</div>
        <div class="sidebar-card-body">
          <div class="stat-row">
            <span class="stat-row-label">Categorías activas</span>
            <span class="stat-row-value" id="statCategories">—</span>
          </div>
        </div>
      </div>
    `;
  }
  if (page === 'explore') {
    html += `
      <div class="sidebar-card">
        <div class="sidebar-card-header">Usuarios más activos</div>
        <div class="sidebar-card-body" id="sidebarActiveUsers">
          <div class="sidebar-loading">Cargando...</div>
        </div>
      </div>
      <div class="sidebar-card">
        <div class="sidebar-card-header">Comunidad</div>
        <div class="sidebar-card-body">
          <div class="stat-row">
            <span class="stat-row-label">Categorías activas</span>
            <span class="stat-row-value" id="statCategories">—</span>
          </div>
        </div>
      </div>
    `;
  }

  aside.innerHTML = html;
}

// Funciones para actualizar el sidebar desde el JS de cada página
function updateSidebarStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderSidebarTags(categories) {
  const container = document.getElementById('sidebarTags');
  if (!container) return;

  // Contar frecuencia de etiquetas
  const tagCount = {};
  categories.forEach(c => {
    const etiquetas = Array.isArray(c.etiquetas)
      ? c.etiquetas.filter(Boolean)
      : (typeof c.etiquetas === 'string'
        ? c.etiquetas.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean)
        : []);
    etiquetas.forEach(tag => {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    });
  });

  const sorted = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) {
    container.innerHTML = `<span class="sidebar-empty">Sin etiquetas aún</span>`;
    return;
  }

  container.innerHTML = `<div class="sidebar-tags-wrap">${
    sorted.map(([tag, count]) =>
      `<a class="sidebar-tag" href="/?q=${encodeURIComponent(tag)}">
        <span class="sidebar-tag-name">${escapeHtml(tag)}</span>
        <span class="sidebar-tag-count">${count}</span>
      </a>`
    ).join('')
  }</div>`;
}

function renderSidebarNewCats(categories) {
  const container = document.getElementById('sidebarNewCats');
  if (!container) return;

  const newest = [...categories]
    .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
    .slice(0, 4);

  if (newest.length === 0) {
    container.innerHTML = `<span class="sidebar-empty">Sin categorías aún</span>`;
    return;
  }

  container.innerHTML = newest.map(c =>
    `<a class="sidebar-cat-item" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
      <span class="sidebar-cat-title">${escapeHtml(c.titulo)}</span>
      <span class="sidebar-cat-count">${Number(c.contador_temas) || 0} temas</span>
    </a>`
  ).join('');
}

async function renderSidebarActiveUsers() {
  const container = document.getElementById('sidebarActiveUsers');
  if (!container) return;

  try {
    const res = await apiGet('/users/most-active?limit=5');
    if (!res?.ok || !res.data.length) {
      container.innerHTML = `<span class="sidebar-empty">Sin datos aún</span>`;
      return;
    }

    container.innerHTML = res.data.map((u, i) => {
      const avatarSrc = u.url_imagen || `${SERVER_BASE}/assets/default-user.jpg`;
      const aportes = Number(u.aportes) || 0;
      return `
        <a class="sidebar-active-user" href="/src/user/profile.html?nickname=${encodeURIComponent(u.nickname)}">
          <span class="sidebar-active-rank">${i + 1}</span>
          <img class="sidebar-active-avatar" src="${escapeHtml(avatarSrc)}" alt=""
            onerror="this.src='${SERVER_BASE}/assets/default-user.jpg'" />
          <div class="sidebar-active-info">
            <span class="sidebar-active-nickname">@${escapeHtml(u.nickname)}</span>
            <span class="sidebar-active-count">${aportes} ${aportes === 1 ? 'aporte' : 'aportes'}</span>
          </div>
        </a>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<span class="sidebar-empty">Error al cargar</span>`;
  }
}