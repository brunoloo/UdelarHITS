function initCarouselArrows(wrapSelector, carouselSelector) {
  const wraps = document.querySelectorAll(wrapSelector);
  wraps.forEach(wrap => {
    const carousel = wrap.querySelector(carouselSelector);
    if (!carousel) return;

    const leftBtn = document.createElement('button');
    leftBtn.className = 'carousel-arrow carousel-arrow--left';
    leftBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';

    const rightBtn = document.createElement('button');
    rightBtn.className = 'carousel-arrow carousel-arrow--right';
    rightBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>';

    wrap.appendChild(leftBtn);
    wrap.appendChild(rightBtn);

    function updateArrows() {
      leftBtn.disabled = carousel.scrollLeft <= 0;
      rightBtn.disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1;
    }

    leftBtn.addEventListener('click', () => {
      carousel.scrollBy({ left: -260, behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', () => {
      carousel.scrollBy({ left: 260, behavior: 'smooth' });
    });

    carousel.addEventListener('scroll', updateArrows);
    updateArrows();
  });
}

function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean);
  return [];
}

// ── Hero: Categoría de la semana ──
function renderHero(category) {
  const section = document.getElementById('heroSection');
  if (!category) {
    section.innerHTML = '';
    return;
  }

  const etiquetas = parseEtiquetas(category.etiquetas);
  const tagsHTML = etiquetas.slice(0, 4).map(e => `<span class="hero-tag">${escapeHtml(e)}</span>`).join('');
  const temas = Number(category.temas_recientes) || 0;
  const comentarios = Number(category.comentarios_recientes) || 0;

  section.innerHTML = `
    <a class="hero-card" href="/src/category/category.html?id=${encodeURIComponent(category.id)}">
      <div class="hero-label">Categoría de la semana</div>
      <div class="hero-title">${escapeHtml(category.titulo)}</div>
      <div class="hero-desc">${escapeHtml(category.descripcion || '')}</div>
      <div class="hero-stats">
        <span>${temas} ${temas === 1 ? 'tema' : 'temas'} esta semana</span>
        <span>·</span>
        <span>${comentarios} ${comentarios === 1 ? 'comentario' : 'comentarios'}</span>
        <span>·</span>
        <span>${Number(category.contador_temas) || 0} temas en total</span>
      </div>
      ${tagsHTML ? `<div class="hero-tags">${tagsHTML}</div>` : ''}
    </a>
  `;
}

// ── Tema del momento ──
function renderTrending(topic) {
  const section = document.getElementById('trendingSection');
  if (!topic) {
    section.innerHTML = '';
    return;
  }

  const previews = topic.comentarios_preview || [];
  const previewsHTML = previews.map(c => {
    const avatarSrc = c.autor_imagen || `${SERVER_BASE}/assets/default-user.jpg`;
    return `
      <div class="trending-comment">
        <img class="trending-comment-avatar" src="${escapeHtml(avatarSrc)}" alt=""
          onerror="this.src='${SERVER_BASE}/assets/default-user.jpg'" />
        <div class="trending-comment-body">
          <div class="trending-comment-author">${escapeHtml(c.autor)}</div>
          <div class="trending-comment-text">${escapeHtml(c.texto || '')}</div>
        </div>
      </div>
    `;
  }).join('');

  const totalComentarios = Number(topic.total_comentarios) || 0;

  section.innerHTML = `
    <div class="explore-section">
      <div class="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="explore-section-title">Tema del momento</span>
      </div>
      <div class="trending-card">
        <div class="trending-meta">
          <a href="/src/category/category.html?id=${encodeURIComponent(topic.categoria_id)}">${escapeHtml(topic.categoria_titulo)}</a>
          <span>·</span>
          <span>${escapeHtml(timeAgo(topic.fecha_creacion))}</span>
          <span>·</span>
          <span>${totalComentarios} ${totalComentarios === 1 ? 'comentario' : 'comentarios'}</span>
        </div>
        <div class="trending-title">
          <a href="/src/topic/topic.html?id=${encodeURIComponent(topic.id)}">${escapeHtml(topic.titulo)}</a>
        </div>
        <div class="trending-body">${escapeHtml(topic.cuerpo || '')}</div>
        ${previews.length > 0 ? `
          <div class="trending-comments-label">Comentarios recientes</div>
          <div class="trending-preview">${previewsHTML}</div>
        ` : ''}
        <div class="trending-footer">
          <a href="/src/topic/topic.html?id=${encodeURIComponent(topic.id)}">Ver conversación completa →</a>
        </div>
      </div>
    </div>
  `;
}

// ── Usuarios sugeridos ──
function renderSuggestedUsers(users) {
  const section = document.getElementById('suggestedSection');
  if (!users || users.length === 0) {
    section.innerHTML = '';
    return;
  }

  const cardsHTML = users.map(u => {
    const avatarSrc = u.url_imagen || `${SERVER_BASE}/assets/default-user.jpg`;
    return `
      <div class="user-mini-card">
        <a href="/src/user/profile.html?nickname=${encodeURIComponent(u.nickname)}">
          <img class="user-mini-avatar" src="${escapeHtml(avatarSrc)}" alt=""
            onerror="this.src='${SERVER_BASE}/assets/default-user.jpg'" />
        </a>
        <a class="user-mini-nickname" href="/src/user/profile.html?nickname=${encodeURIComponent(u.nickname)}">@${escapeHtml(u.nickname)}</a>
        <button class="btn-follow-sm" data-nickname="${escapeHtml(u.nickname)}">Seguir</button>
      </div>
    `;
  }).join('');

  section.innerHTML = `
    <div class="explore-section">
      <div class="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="explore-section-title">Usuarios que podrías seguir</span>
      </div>
      <div class="user-carousel-wrap">
        <div class="user-carousel" id="userCarousel">${cardsHTML}</div>
      </div>
    </div>
  `;

  // Follow buttons con optimistic update
  section.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-follow-sm');
  if (!btn || btn.disabled) return;

  const nickname = btn.dataset.nickname;
  const card = btn.closest('.user-mini-card');

  btn.disabled = true;
  btn.textContent = 'Siguiendo...';

  try {
    const res = await apiPost(`/users/${encodeURIComponent(nickname)}/follow`, {});
    if (res.ok) {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.8)';
      setTimeout(() => {
        card.remove();
        // Si no quedan usuarios, ocultar la sección
        const remaining = section.querySelectorAll('.user-mini-card');
        if (remaining.length === 0) {
          section.innerHTML = '';
        }
      }, 300);
    } else {
      btn.textContent = 'Seguir';
      btn.disabled = false;
    }
  } catch (err) {
    btn.textContent = 'Seguir';
    btn.disabled = false;
  }
});

  // Inicializar flechas del carrusel
  initCarouselArrows('.user-carousel-wrap', '.user-carousel');
}

// ── Categorías para vos ──
function renderCategorySuggestions(allCategories, myCategories) {
  const section = document.getElementById('categoriesSection');

  // Obtener etiquetas de categorías donde participo
  const myIds = new Set((myCategories || []).map(c => c.id));
  const myTags = new Set();
  (myCategories || []).forEach(c => {
    parseEtiquetas(c.etiquetas).forEach(t => myTags.add(t));
  });

  // Categorías donde no participo
  const others = allCategories.filter(c => !myIds.has(c.id));

  if (others.length === 0) {
    section.innerHTML = '';
    return;
  }

  // Agrupar por etiqueta (priorizar las que matchean mis intereses)
  const tagGroups = {};
  others.forEach(c => {
    parseEtiquetas(c.etiquetas).forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      if (!tagGroups[tag].find(x => x.id === c.id)) {
        tagGroups[tag].push(c);
      }
    });
  });

  // Ordenar: primero etiquetas que matchean mis intereses, después las demás por cantidad
  const sortedTags = Object.entries(tagGroups)
    .sort((a, b) => {
      const aMatch = myTags.has(a[0]) ? 0 : 1;
      const bMatch = myTags.has(b[0]) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return b[1].length - a[1].length;
    })
    .slice(0, 5);

  if (sortedTags.length === 0) {
    section.innerHTML = '';
    return;
  }

  let html = `
    <div class="explore-section">
      <div class="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        <span class="explore-section-title">Categorías para vos</span>
      </div>
  `;

  sortedTags.forEach(([tag, cats]) => {
    const cardsHTML = cats.slice(0, 8).map(c => {
      const count = Number(c.contador_temas) || 0;
      const etiquetas = parseEtiquetas(c.etiquetas);
      const tagsHTML = etiquetas.slice(0, 2).map(e => `<span class="tag">${escapeHtml(e)}</span>`).join('');

      return `
        <a class="cat-mini-card" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
          <div class="cat-mini-title">${escapeHtml(c.titulo)}</div>
          <div class="cat-mini-desc">${escapeHtml(c.descripcion || '')}</div>
          <div class="cat-mini-footer">
            <span>${count} ${count === 1 ? 'tema' : 'temas'}</span>
            <div class="cat-mini-tags">${tagsHTML}</div>
          </div>
        </a>
      `;
    }).join('');

    html += `
      <div style="margin-bottom: 16px;">
        <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:8px;">${escapeHtml(tag)}</div>
        <div class="category-carousel">${cardsHTML}</div>
      </div>
    `;
  });

  html += '</div>';section.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-follow-sm');
  if (!btn || btn.disabled) return;

  const nickname = btn.dataset.nickname;
  const card = btn.closest('.user-mini-card');

  btn.disabled = true;
  btn.textContent = 'Siguiendo...';

  try {
    const res = await apiPost(`/users/${encodeURIComponent(nickname)}/follow`, {});
    if (res.ok) {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.8)';
      setTimeout(() => {
        card.remove();
        // Si no quedan usuarios, ocultar la sección
        const remaining = section.querySelectorAll('.user-mini-card');
        if (remaining.length === 0) {
          section.innerHTML = '';
        }
      }, 300);
    } else {
      btn.textContent = 'Seguir';
      btn.disabled = false;
    }
  } catch (err) {
    btn.textContent = 'Seguir';
    btn.disabled = false;
  }
});

  // Wrap de carruseles de categorías para flechas
  section.querySelectorAll('.category-carousel').forEach(carousel => {
    const wrap = document.createElement('div');
    wrap.className = 'user-carousel-wrap';
    carousel.parentNode.insertBefore(wrap, carousel);
    wrap.appendChild(carousel);
  });
  initCarouselArrows('.user-carousel-wrap', '.category-carousel');

  section.innerHTML = html;
}

// ── Carga principal ──
async function loadExplore() {
  const isLoggedIn = (await apiGet('/users/me'))?.ok;

  // Cargar todo en paralelo
  const promises = [
    apiGet('/categories/popular?days=7&limit=1'),
    apiGet('/topics/trending'),
    apiGet('/categories/active')
  ];

  // Solo cargar sugeridos si está logueado
  if (isLoggedIn) {
    promises.push(apiGet('/users/suggested?limit=12'));
    promises.push(apiGet('/categories/me'));
  }

  const results = await Promise.all(promises);

  const popularRes = results[0];
  const trendingRes = results[1];
  const catsRes = results[2];
  const suggestedRes = isLoggedIn ? results[3] : null;
  const myCatsRes = isLoggedIn ? results[4] : null;

  // Render hero
  const popularCat = popularRes.ok && popularRes.data?.length > 0 ? popularRes.data[0] : null;
  renderHero(popularCat);

  // Render trending
  const trendingTopic = trendingRes.ok ? trendingRes.data : null;
  renderTrending(trendingTopic);

  // Render usuarios sugeridos
  if (suggestedRes?.ok) {
    renderSuggestedUsers(suggestedRes.data);
  }

  // Render categorías para vos
  const allCats = catsRes.ok ? catsRes.data : [];
  if (isLoggedIn) {
    const myCats = myCatsRes?.ok ? myCatsRes.data : [];
    renderCategorySuggestions(allCats, myCats);
  } else {
    const section = document.getElementById('categoriesSection');
    section.innerHTML = `
      <div class="explore-section">
        <div class="explore-section-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <span class="explore-section-title">Categorías para vos</span>
        </div>
        <div class="explore-empty">
          Creá una cuenta para que podamos recomendarte categorías basadas en tus intereses.
          <div style="margin-top: 12px; text-align: center;">
            <a href="/src/auth/register.html" style="display:inline-block; margin-top:12px; padding:8px 20px; background:var(--accent); color:var(--text-on-accent); border-radius:999px; text-decoration:none; font-size:13px; font-weight:600;">Crear cuenta</a>
          </div>
        </div>
      </div>
    `;
  }

  // Sidebar
  updateSidebarStat('statCategories', allCats.length);
  renderSidebarTags(allCats);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initSidebar({ page: 'explore' });
  renderSidebarActiveUsers();
  await loadExplore();
});