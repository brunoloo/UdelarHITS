let allCategories = [];

async function loadHeader() {
  let res = null;
  try {
    res = await apiGet("/users/me");
  } catch (e) {
    // Si no tiene cuenta, puede navegar en la aplicación
  }
     
  const actions = document.getElementById("headerActions");


// Si el usuario está autenticado se carga su avatar en el header
  if (res?.ok) {
    const user = res.data.user;
    document.getElementById("joinBanner")?.remove();
    actions.innerHTML = `
      <a class="user-chip" href="/src/user/profile.html">
        <img class="user-avatar"
          src="${API_BASE}/users/${encodeURIComponent(user.id)}/avatar"
          alt="${escapeHtml(user.nickname)}"
          onerror="this.style.display='none'" />
        ${escapeHtml(user.nickname)}
      </a>
    `;
  } else {
  const banner = document.getElementById("joinBanner");
  if (banner) banner.style.display = "block";
  actions.innerHTML = `
    <a class="btn-ghost" href="/src/auth/login.html">Iniciar sesión</a>
    <a class="btn-primary" href="/src/auth/register.html">Registrarse</a>
  `;
  }
}

function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean);
  return [];
}

function renderCategories(list) {
  const feed = document.getElementById("categoriesFeed");

  if (list.length === 0) {
    feed.innerHTML = `<div class="feed-empty">No se encontraron categorías.</div>`;
    return;
  }

  feed.innerHTML = list.map(c => {
  const etiquetas = parseEtiquetas(c.etiquetas);
  const tagsHTML = etiquetas.slice(0, 3).map(e => `<span class="tag">${escapeHtml(e)}</span>`).join('');

  const ultimoTema = c.ultimo_tema
    ? `<div class="last-activity">
        <span class="last-activity-label">Último tema:</span>
        <span class="last-activity-title">${escapeHtml(c.ultimo_tema.titulo)}</span>
        <span class="last-activity-meta">por ${escapeHtml(c.ultimo_tema.autor)} · ${escapeHtml(new Date(c.ultimo_tema.fecha).toLocaleDateString())}</span>
      </div>`
    : `<div class="last-activity no-activity">Todavía no hay temas publicados</div>`;

  const count = Number(c.contador_temas) || 0;
  return `
    <a class="category-card" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
      <div class="category-body">
        <div class="category-header-row">
          <div class="category-title">${escapeHtml(c.titulo)}</div>
          <div class="category-stats">${count} ${count === 1 ? 'tema' : 'temas'}</div>
        </div>
        <div class="category-footer">${tagsHTML}</div>
        ${ultimoTema}
      </div>
    </a>
  `;
    }).join('');
}

async function loadCategories() {
  const res = await apiGet("/categories/active");
  if (!res?.ok) return;
  allCategories = res.data;
  renderCategories(allCategories);
  document.getElementById("statCategories").textContent = allCategories.length;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderCategories(allCategories); return; }
    renderCategories(allCategories.filter(c =>
      c.titulo.toLowerCase().includes(q) ||
      c.descripcion?.toLowerCase().includes(q)
    ));
  });
});

const navItems = document.querySelectorAll('.nav-item');
const feedTitle = document.getElementById('feedTitle');

function setActive(id) {
  navItems.forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function sortAndRender(mode) {
  let list = [...allCategories];
  if (mode === 'populares') {
    list.sort((a, b) => (b.contador_temas ?? 0) - (a.contador_temas ?? 0));
    feedTitle.textContent = 'Populares';
  } else if (mode === 'recientes') {
    list.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
    feedTitle.textContent = 'Recientes';
  } else {
    feedTitle.textContent = 'Categorías';
  }
  renderCategories(list);
}

document.getElementById('nav-explorar')?.addEventListener('click', (e) => {
  e.preventDefault();
  setActive('nav-explorar');
  sortAndRender('explorar');
});

document.getElementById('nav-populares')?.addEventListener('click', (e) => {
  e.preventDefault();
  setActive('nav-populares');
  sortAndRender('populares');
});

document.getElementById('nav-recientes')?.addEventListener('click', (e) => {
  e.preventDefault();
  setActive('nav-recientes');
  sortAndRender('recientes');
});

document.getElementById('nav-inicio')?.addEventListener('click', () => {
  setActive('nav-inicio');
  sortAndRender('inicio');
});

loadHeader();
loadCategories();