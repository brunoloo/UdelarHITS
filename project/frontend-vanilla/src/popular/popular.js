function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean);
  return [];
}

function renderPopularCard(c, rank) {
  const etiquetas = parseEtiquetas(c.etiquetas);
  const tagsHTML = etiquetas.slice(0, 3).map(e => `<span class="tag">${escapeHtml(e)}</span>`).join('');
  const count = Number(c.contador_temas) || 0;
  const temasRecientes = Number(c.temas_recientes) || 0;
  const comentariosRecientes = Number(c.comentarios_recientes) || 0;

  return `
    <a class="popular-card" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
      <div class="popular-rank">${rank}</div>
      <div class="popular-body">
        <div class="popular-header-row">
          <div class="popular-card-title">${escapeHtml(c.titulo)}</div>
          <div class="popular-card-stats">${count} ${count === 1 ? 'tema' : 'temas'}</div>
        </div>
        <div class="popular-desc">${escapeHtml(c.descripcion || '')}</div>
        <div class="popular-footer">
          <div class="popular-activity">
            <span class="popular-activity-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              ${temasRecientes} ${temasRecientes === 1 ? 'tema' : 'temas'} · ${comentariosRecientes} ${comentariosRecientes === 1 ? 'comentario' : 'comentarios'} esta semana
            </span>
          </div>
          ${tagsHTML ? `<div class="popular-tags">${tagsHTML}</div>` : ''}
        </div>
      </div>
    </a>
  `;
}

async function loadPopular() {
  const feed = document.getElementById('popularFeed');

  // Skeleton
  feed.innerHTML = Array(5).fill(`
    <div class="skeleton-card" style="display:flex;gap:12px;">
      <div class="skeleton" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div class="skeleton skeleton-line" style="width:50%;"></div>
        <div class="skeleton skeleton-line" style="width:80%;"></div>
        <div class="skeleton skeleton-line" style="width:35%;"></div>
      </div>
    </div>
  `).join('');

  const [popularRes, catsRes] = await Promise.all([
    apiGet('/categories/popular?days=7&limit=20'),
    apiGet('/categories/active')
  ]);

  const popular = popularRes.ok ? popularRes.data : [];
  const allCats = catsRes.ok ? catsRes.data : [];

  if (popular.length === 0) {
    feed.innerHTML = `<div class="feed-empty">No hubo actividad esta semana. ¡Sé el primero en participar!</div>`;
  } else {
    feed.innerHTML = popular.map((c, i) => renderPopularCard(c, i + 1)).join('');
  }

  // Sidebar
  updateSidebarStat('statCategories', allCats.length);
  renderSidebarNewCats(allCats);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initSidebar({ page: 'popular' });
  await loadPopular();
});