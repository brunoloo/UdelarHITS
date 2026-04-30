let allCategories = [];
let isAuthenticated = false;

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
    isAuthenticated = true;
    const user = res.data.user;
    document.getElementById("joinBanner")?.remove();
    actions.innerHTML = `
      <a class="user-chip" href="/src/user/profile.html">
        <img class="user-avatar"
          src="${API_BASE}/users/${encodeURIComponent(user.id)}/avatar"
          alt="${escapeHtml(user.nickname)}" />
        ${escapeHtml(user.nickname)}
      </a>
    `;
    actions.querySelector('img.user-avatar')?.addEventListener('error', (ev) => {
      ev.currentTarget.style.display = 'none';
    });

    // ── Actualizar avatar del trigger ──
    const ccAvatar = document.querySelector('.cc-avatar');
    if (ccAvatar) {
      const img = document.createElement('img');
      img.src = `${API_BASE}/users/${encodeURIComponent(user.id)}/avatar`;
      img.alt = escapeHtml(user.nickname);
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      img.addEventListener('error', () => img.style.display = 'none');
      ccAvatar.innerHTML = '';
      ccAvatar.appendChild(img);
    }
  } else {
    const banner = document.getElementById("joinBanner");
    if (banner) banner.style.display = "block";
    actions.innerHTML = `
      <a class="btn-ghost" href="/src/auth/login.html">Iniciar sesión</a>
      <a class="btn-primary" href="/src/auth/register.html">Registrarse</a>
    `;
     // Avatar default en el trigger
    const ccAvatar = document.querySelector('.cc-avatar');
    if (ccAvatar) {
      const img = document.createElement('img');
      img.src = SERVER_BASE + '/assets/default-user.jpg';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      img.addEventListener('error', () => img.style.display = 'none');
      ccAvatar.innerHTML = '';
      ccAvatar.appendChild(img);
    }
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
  let searchTimeout = null;

  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    const dropdown = document.getElementById('searchDropdown');

    if (!q) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      renderCategories(allCategories);
      return;
    }

    // Filtrar categorías en frontend
    const catResults = allCategories.filter(c =>
      c.titulo.toLowerCase().split(/\s+/).some(word => word.startsWith(q.toLowerCase()))
    ).slice(0, 3);

    // Filtrar etiquetas en frontend
    const tagResults = availableTags.filter(t => {
      const wordMatch = t.toLowerCase().split(/\s+/).some(word => word.startsWith(q.toLowerCase()));
      if (!wordMatch) return false;
      const count = allCategories.filter(c => {
        const etiquetas = parseEtiquetas(c.etiquetas);
        return etiquetas.some(e => e.toLowerCase() === t.toLowerCase());
      }).length;
      return count > 0;
    }).slice(0, 3);

    // Categorías que tienen esas etiquetas (sin duplicar las que ya salieron por nombre)
    const catIdsByName = new Set(catResults.map(c => c.id));
    const catsByTag = tagResults.length > 0
      ? allCategories.filter(c => {
          if (catIdsByName.has(c.id)) return false;
          const etiquetas = parseEtiquetas(c.etiquetas);
          return etiquetas.some(e => e.toLowerCase().includes(q.toLowerCase()));
        }).slice(0, 3)
      : [];

    // Buscar usuarios en backend (con debounce)
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      let userResults = [];
      if (q.length >= 2) {
        const res = await apiGet(`/users/search?q=${encodeURIComponent(q)}`);
        if (res?.ok) userResults = res.data;
      }
      renderSearchDropdown(catResults, tagResults, catsByTag, userResults, q);
    }, 250);

    // Render inmediato sin usuarios (se actualiza cuando llega el backend)
    renderSearchDropdown(catResults, tagResults, catsByTag, [], q);
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('searchDropdown');
    const searchBar = document.querySelector('.search-bar');
    if (!searchBar?.contains(e.target)) {
      dropdown?.classList.remove('open');
    }
  });

  function renderSearchDropdown(categories, tags, catsByTag, users, query) {
    const dropdown = document.getElementById('searchDropdown');
    const hasResults = categories.length || tags.length || catsByTag.length || users.length;

    if (!hasResults) {
      dropdown.innerHTML = `<div class="search-empty">No se encontraron resultados para "${escapeHtml(query)}"</div>`;
      dropdown.classList.add('open');
      return;
    }

    let html = '';

    // Categorías por nombre
    if (categories.length) {
      html += `<div class="search-section-title">Categorías</div>`;
      html += categories.map(c => `
        <a class="search-item" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
          <div class="search-item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          </div>
          <div class="search-item-info">
            <div class="search-item-title">${escapeHtml(c.titulo)}</div>
            <div class="search-item-sub">${Number(c.contador_temas) || 0} temas</div>
          </div>
        </a>
      `).join('');
    }

    // Etiquetas
    if (tags.length) {
      if (categories.length) html += `<div class="search-divider"></div>`;
      html += `<div class="search-section-title">Etiquetas</div>`;
      tags.forEach(tag => {
        const matching = allCategories.filter(c => {
          const etiquetas = parseEtiquetas(c.etiquetas);
          return etiquetas.some(e => e.toLowerCase() === tag.toLowerCase());
        });
        html += `
          <a class="search-item" href="#" data-search-tag="${escapeHtml(tag)}">
            <div class="search-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            </div>
            <div class="search-item-info">
              <div class="search-item-title">${escapeHtml(tag)}</div>
              <div class="search-item-sub">${matching.length} ${matching.length === 1 ? 'categoría' : 'categorías'}</div>
            </div>
          </a>
        `;
      });
    }

    // Usuarios
    if (users.length) {
      if (categories.length || tags.length) html += `<div class="search-divider"></div>`;
      html += `<div class="search-section-title">Usuarios</div>`;
      html += users.map(u => `
        <a class="search-item" href="/src/user/profile.html?nickname=${encodeURIComponent(u.nickname)}">
          <img class="search-item-avatar" 
              src="${API_BASE}/users/${encodeURIComponent(u.id)}/avatar" 
              alt="${escapeHtml(u.nickname)}"
          <div class="search-item-info">
            <div class="search-item-title">@${escapeHtml(u.nickname)}</div>
            <div class="search-item-sub">${escapeHtml(u.nombre)}</div>
          </div>
        </a>
      `).join('');
    }

    dropdown.innerHTML = html;
    dropdown.querySelectorAll('.search-item-avatar').forEach(img => {
      img.addEventListener('error', () => {
        img.src = SERVER_BASE + '/assets/default-user.jpg';
      });
    });
    dropdown.classList.add('open');

    // Listener para etiquetas: filtrar feed por etiqueta
    dropdown.querySelectorAll('[data-search-tag]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = el.dataset.searchTag;
        const filtered = allCategories.filter(c => {
          const etiquetas = parseEtiquetas(c.etiquetas);
          return etiquetas.some(et => et.toLowerCase() === tag.toLowerCase());
        });
        renderCategories(filtered);
        dropdown.classList.remove('open');
        document.getElementById('searchInput').value = tag;
      });
    });
  }

  let availableTags = [];
  let selectedTags = [];

  function renderTags() {
    const container = document.getElementById('tagsSelector');
    if (!container) return;
    container.innerHTML = availableTags.map(tag =>
      `<button type="button" class="tag-option${selectedTags.includes(tag) ? ' selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
    ).join('');

    container.querySelectorAll('.tag-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (selectedTags.includes(tag)) {
          selectedTags = selectedTags.filter(t => t !== tag);
          btn.classList.remove('selected');
        } else if (selectedTags.length < 10) {
          selectedTags.push(tag);
          btn.classList.add('selected');
        }
        document.getElementById('catTagsCounter').textContent = selectedTags.length + ' / 10';
        syncCatCounters();
      });
    });
  }
  
  async function loadEtiquetas() {
    const res = await apiGet('/categories/etiquetas');
    if (!res?.ok) return;
    availableTags = res.data;
    renderTags();
  }
  
  const openCreateCat   = document.getElementById('openCreateCat');
  const createCatPanel  = document.getElementById('createCatPanel');
  const closeCreateCat  = document.getElementById('closeCreateCat');
  const submitCreateCat = document.getElementById('submitCreateCat');
  const catTitle        = document.getElementById('catTitle');
  const catDesc         = document.getElementById('catDesc');
  const catTitleCounter = document.getElementById('catTitleCounter');
  const catDescCounter  = document.getElementById('catDescCounter');
  
  function syncCatCounters() {
    catTitleCounter.textContent = catTitle.value.length + ' / 60';
    catDescCounter.textContent  = catDesc.value.length  + ' / 200';
    const ok = catTitle.value.trim().length >= 3 
    && catDesc.value.trim().length >= 1 
    && selectedTags.length >= 1;
    submitCreateCat.disabled = !ok;
  }
  
  function openCatPanel() {
    document.querySelector('.cc-placeholder').style.display = 'none';
    document.querySelector('.cc-cta').style.display = 'none';
    openCreateCat.style.display = 'none';
    
    const avatar = document.querySelector('.cc-avatar');
    document.querySelector('.create-cat-panel-body').prepend(avatar);
    
    createCatPanel.classList.add('open');
    catTitle.value = '';
    catDesc.value  = '';
    selectedTags = [];
    syncCatCounters();
    renderTags();
    setTimeout(() => catTitle.focus(), 50);
  }
  
  function closeCatPanel() {
    createCatPanel.classList.remove('open');
    
    const avatar = document.querySelector('.cc-avatar');
    openCreateCat.prepend(avatar);
    
    document.querySelector('.cc-placeholder').style.display = '';
    document.querySelector('.cc-cta').style.display = '';
    openCreateCat.style.display = 'flex';
  }
  
  openCreateCat.addEventListener('click', openCatPanel);
  closeCreateCat.addEventListener('click', closeCatPanel);
  catTitle.addEventListener('input', syncCatCounters);
  catDesc.addEventListener('input', syncCatCounters);
  
  submitCreateCat.addEventListener('click', async () => {
    if (submitCreateCat.disabled) return;
    if (!isAuthenticated) {
      window.location.href = '/src/auth/login.html?msg=crear-categoria';
      return;
    }
    
    submitCreateCat.disabled = true;
    submitCreateCat.textContent = 'Creando...';
    
    const result = await apiPost('/categories/create', {
      titulo: catTitle.value.trim(),
      descripcion: catDesc.value.trim(),
      etiquetas: selectedTags
    });
    
    if (result.ok) {
      closeCatPanel();
      showToast('Categoría creada correctamente', 'success');
      await loadCategories();
    } else {
      showToast(result.message || 'Error al crear la categoría', 'error');
      submitCreateCat.disabled = false;
      submitCreateCat.textContent = 'Crear';
    }
  });
  
  loadEtiquetas();
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