let recentTopics = [];
let recentCategories = [];
let currentTab = 'todos';

function renderFeed() {
  const feed = document.getElementById('recentFeed');

  let items = [];

  if (currentTab === 'todos' || currentTab === 'temas') {
    items.push(...recentTopics.map(t => ({ type: 'tema', data: t, date: new Date(t.fecha_creacion) })));
  }

  if (currentTab === 'todos' || currentTab === 'categorias') {
    items.push(...recentCategories.map(c => ({ type: 'categoria', data: c, date: new Date(c.fecha_creacion) })));
  }

  // Ordenar por fecha descendente
  items.sort((a, b) => b.date - a.date);

  if (items.length === 0) {
    feed.innerHTML = `<div class="feed-empty">No hay contenido reciente todavía.</div>`;
    return;
  }

  feed.innerHTML = items.map(item => {
    if (item.type === 'tema') {
      return renderTopicCard(item.data);
    } else {
      return renderCategoryCard(item.data);
    }
  }).join('');

  // Click handlers para topic cards
  feed.querySelectorAll('.topic-card[data-topic-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.location.href = `/src/topic/topic.html?id=${card.dataset.topicId}`;
    });
  });
}

function renderTopicCard(t) {
  const commentCount = Number(t.contador_comentarios) || 0;
  const avatarSrc = t.autor_url_imagen || `${SERVER_BASE}/assets/default-user.jpg`;

  return `
    <div class="topic-card" data-topic-id="${encodeURIComponent(t.id)}">
      <img class="topic-avatar" 
        src="${escapeHtml(avatarSrc)}" 
        alt="${escapeHtml(t.autor_nickname)}"
        onerror="this.src='${SERVER_BASE}/assets/default-user.jpg'" />
      <div class="topic-body">
        <div class="topic-head">
          <a href="/src/user/profile.html?nickname=${encodeURIComponent(t.autor_nickname)}">${escapeHtml(t.autor_nickname)}</a>
          <span>·</span>
          <span>${escapeHtml(timeAgo(t.fecha_creacion))}</span>
          <span>·</span>
          <a href="/src/category/category.html?id=${encodeURIComponent(t.categoria_id)}" class="recent-category-badge">${escapeHtml(t.categoria_titulo)}</a>
        </div>
        <a class="topic-title" href="/src/topic/topic.html?id=${encodeURIComponent(t.id)}">${escapeHtml(t.titulo)}</a>
        <div class="topic-preview">${escapeHtml(t.cuerpo || '')}</div>
        <div class="topic-footer">
          <span class="topic-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${commentCount} ${commentCount === 1 ? 'comentario' : 'comentarios'}
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderCategoryCard(c) {
  const etiquetas = parseEtiquetas(c.etiquetas);
  const tagsHTML = etiquetas.slice(0, 3).map(e => `<span class="tag">${escapeHtml(e)}</span>`).join('');
  const count = Number(c.contador_temas) || 0;

  return `
    <a class="recent-cat-card" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
      <div class="recent-cat-header">
        <span class="recent-type-badge recent-type-badge--cat">Categoría</span>
        <span class="recent-cat-meta">${escapeHtml(timeAgo(c.fecha_creacion))} · por ${escapeHtml(c.autor_nickname)}</span>
      </div>
      <div class="recent-cat-title">${escapeHtml(c.titulo)}</div>
      <div class="recent-cat-desc">${escapeHtml(c.descripcion || '')}</div>
      <div class="recent-cat-footer">
        <span class="recent-cat-count">${count} ${count === 1 ? 'tema' : 'temas'}</span>
        ${tagsHTML ? `<div class="recent-cat-tags">${tagsHTML}</div>` : ''}
      </div>
    </a>
  `;
}

function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean);
  return [];
}

async function loadRecent() {
  const feed = document.getElementById('recentFeed');

  // Skeleton
  feed.innerHTML = Array(5).fill(`
    <div class="topic-card skeleton-card">
      <div class="skeleton skeleton-avatar"></div>
      <div class="topic-body">
        <div class="skeleton skeleton-line" style="width:40%"></div>
        <div class="skeleton skeleton-line" style="width:70%"></div>
        <div class="skeleton skeleton-line" style="width:55%"></div>
      </div>
    </div>
  `).join('');

  // Cargar temas y categorías en paralelo
  const [topicsRes, catsRes] = await Promise.all([
    apiGet('/topics/recent?limit=30'),
    apiGet('/categories/active')
  ]);

  recentTopics = topicsRes.ok ? topicsRes.data : [];
  recentCategories = catsRes.ok ? catsRes.data : [];

  // Tabs
  document.querySelectorAll('.recent-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.recent-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderFeed();
    });
  });

  renderFeed();
  // Actualizar sidebar
  updateSidebarStat('statCategories', recentCategories.length);
  updateSidebarStat('statTopics', recentTopics.length);
  renderSidebarTags(recentCategories);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initSidebar({ page: 'recent' });
  await loadRecent();
});