function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean);
  return [];
}

function renderTopics(topics) {
  const feed = document.getElementById('topicsFeed');

  if (!topics || topics.length === 0) {
    feed.innerHTML = `<div class="feed-empty">Todavía no hay temas en esta categoría. ¡Sé el primero en crear uno!</div>`;
    return;
  }

  feed.innerHTML = topics.map(t => {
    const commentCount = Number(t.contador_comentarios) || 0;
    return `
      <a class="topic-card" href="/src/topic/topic.html?id=${encodeURIComponent(t.contenido_id)}">
        <img class="topic-avatar" 
             src="${API_BASE}/users/${encodeURIComponent(t.autor_id)}/avatar" 
             alt="${escapeHtml(t.autor_nickname)}" />
        <div class="topic-body">
          <div class="topic-head">
            <span>${escapeHtml(t.autor_nickname)}</span>
            <span>·</span>
            <span>${escapeHtml(timeAgo(t.fecha_creacion))}</span>
          </div>
          <div class="topic-title">${escapeHtml(t.titulo)}</div>
          <div class="topic-preview">${escapeHtml(t.cuerpo || '')}</div>
          <div class="topic-footer">
            <span class="topic-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${commentCount} ${commentCount === 1 ? 'comentario' : 'comentarios'}
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('');

  // Fallback de avatares
  feed.querySelectorAll('.topic-avatar').forEach(img => {
    img.addEventListener('error', () => {
      img.src = SERVER_BASE + '/assets/default-user.jpg';
    });
  });
}

async function loadCategory() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = '/';
    return;
  }

  // Cargar datos de la categoría
  const res = await apiGet(`/categories/${id}`);

  if (!res?.ok) {
    window.showToast && window.showToast('Categoría no encontrada', 'error');
    window.location.href = '/';
    return;
  }

  const cat = res.data;

  // Breadcrumb
  document.getElementById('breadcrumbTitle').textContent = cat.titulo;
  document.title = `${cat.titulo} — UdelarHITS`;

  // Header
  document.getElementById('catTitle').textContent = cat.titulo;
  document.getElementById('catDesc').textContent = cat.descripcion;

  // Etiquetas
  const etiquetas = parseEtiquetas(cat.etiquetas);
  document.getElementById('catTags').innerHTML = etiquetas
    .map(e => `<span class="tag">${escapeHtml(e)}</span>`)
    .join('');

  // Meta
  const count = Number(cat.contador_temas) || 0;
  document.getElementById('catMeta').innerHTML = `
    <span class="cat-meta-item"><strong>${count}</strong> ${count === 1 ? 'tema' : 'temas'}</span>
    <span class="cat-meta-item">creada el <strong>${escapeHtml(new Date(cat.fecha_creacion).toLocaleDateString('es-UY'))}</strong></span>
  `;

  // Sidebar stats
  document.getElementById('statTemas').textContent = count;
  document.getElementById('statCreada').textContent = new Date(cat.fecha_creacion).toLocaleDateString('es-UY');

  // Temas
  if (cat.topics) {
    renderTopics(cat.topics);
  }

  // Comentarios
  const repliesRes = await apiGet(`/replies/category/${id}`);
  const commentCount = repliesRes?.ok ? repliesRes.data.length : 0;
  document.getElementById('statComentarios').textContent = commentCount;

  // Configurar módulo de comentarios
  let meRes = null;
  try { meRes = await apiGet('/users/me'); } catch (e) {}

  setCommentConfig({
    meRes,
    reloadFn: async () => {
      const repliesUpdated = await apiGet(`/replies/category/${id}`);
      const updatedComments = repliesUpdated?.ok ? repliesUpdated.data : [];
      document.getElementById('countComentarios').textContent = updatedComments.length;
      document.getElementById('statComentarios').textContent = updatedComments.length;
      renderComments(updatedComments, null);
    }
  });

  // Renderizar comentarios
  if (repliesRes?.ok && repliesRes.data.length > 0) {
    renderComments(repliesRes.data, null);
  } else {
    document.getElementById('commentsFeed').innerHTML =
      `<div class="feed-empty">Todavía no hay comentarios en esta categoría.</div>`;
  }

  // Counters en tabs
  document.getElementById('countTemas').textContent = cat.topics?.length || 0;
  document.getElementById('countComentarios').textContent = commentCount;

  // Lógica de tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      // Resetear la pila de comentarios al cambiar de tab
      resetCommentStack();
    });
  });

  // Moderación
  const modList = document.getElementById('modList');
  modList.innerHTML = `
    <div class="mod-item">
      <div class="mod-avatar">
        <img src="${API_BASE}/users/${encodeURIComponent(cat.autor_id || cat.autor_nickname)}/avatar" alt="" />
      </div>
      <div class="mod-info">
        <span class="mod-name"><a href="/src/user/profile.html?nickname=${encodeURIComponent(cat.autor_nickname)}">${escapeHtml(cat.autor_nickname)}</a></span>
        <span class="mod-role">moderador</span>
      </div>
    </div>
  `;

  modList.querySelectorAll('.mod-avatar img').forEach(img => {
    img.addEventListener('error', () => {
      img.src = SERVER_BASE + '/assets/default-user.jpg';
    });
  });

  // Avatar de los triggers
  const ctAvatars = document.querySelectorAll('.ct-avatar');
  if (meRes?.ok) {
    ctAvatars.forEach(ctAvatar => {
      const img = document.createElement('img');
      img.src = `${API_BASE}/users/${encodeURIComponent(meRes.data.user.id)}/avatar`;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      img.addEventListener('error', () => img.style.display = 'none');
      ctAvatar.innerHTML = '';
      ctAvatar.appendChild(img);
    });
  } else {
    ctAvatars.forEach(ctAvatar => {
      const img = document.createElement('img');
      img.src = SERVER_BASE + '/assets/default-user.jpg';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      img.addEventListener('error', () => img.style.display = 'none');
      ctAvatar.innerHTML = '';
      ctAvatar.appendChild(img);
    });
  }

  // ── Panel crear tema ──
  const openTopicBtn = document.getElementById('openCreateTopic');
  const topicPanel = document.getElementById('createTopicPanel');
  const closeTopicBtn = document.getElementById('closeCreateTopic');
  const submitTopicBtn = document.getElementById('submitCreateTopic');
  const topicTitleInput = document.getElementById('topicTitle');
  const topicBodyInput = document.getElementById('topicBody');
  const topicTitleCounter = document.getElementById('topicTitleCounter');
  const topicBodyCounter = document.getElementById('topicBodyCounter');

  function syncTopicCounters() {
    topicTitleCounter.textContent = topicTitleInput.value.length + ' / 100';
    topicBodyCounter.textContent = topicBodyInput.value.length + ' / 750';
    const ok = topicTitleInput.value.trim().length >= 3 && topicBodyInput.value.trim().length >= 1;
    submitTopicBtn.disabled = !ok;
  }

  openTopicBtn.addEventListener('click', () => {
    if (!meRes?.ok) {
      window.location.href = '/src/auth/login.html?msg=crear-tema';
      return;
    }
    openTopicBtn.style.display = 'none';
    const avatar = openTopicBtn.querySelector('.ct-avatar');
    document.querySelector('#createTopicPanel .create-cat-panel-body').prepend(avatar);
    topicPanel.classList.add('open');
    topicTitleInput.value = '';
    topicBodyInput.value = '';
    syncTopicCounters();
    setTimeout(() => topicTitleInput.focus(), 50);
  });

  closeTopicBtn.addEventListener('click', () => {
    topicPanel.classList.remove('open');
    const avatar = topicPanel.querySelector('.ct-avatar');
    openTopicBtn.prepend(avatar);
    openTopicBtn.style.display = 'flex';
  });

  topicTitleInput.addEventListener('input', syncTopicCounters);
  topicBodyInput.addEventListener('input', syncTopicCounters);

  submitTopicBtn.addEventListener('click', async () => {
    if (submitTopicBtn.disabled) return;
    submitTopicBtn.disabled = true;
    submitTopicBtn.textContent = 'Creando...';

    const result = await apiPost('/topics/create', {
      titulo: topicTitleInput.value.trim(),
      cuerpo: topicBodyInput.value.trim(),
      categoria_id: id
    });

    if (result.ok) {
      const avatar = topicPanel.querySelector('.ct-avatar');
      if (avatar) openTopicBtn.prepend(avatar);
      topicPanel.classList.remove('open');
      openTopicBtn.style.display = 'flex';
      showToast('Tema creado correctamente', 'success');
      const updatedRes = await apiGet(`/categories/${id}`);
      if (updatedRes?.ok) {
        renderTopics(updatedRes.data.topics);
        document.getElementById('countTemas').textContent = updatedRes.data.topics?.length || 0;
        document.getElementById('statTemas').textContent = updatedRes.data.topics?.length || 0;
      }
    } else {
      showToast(result.message || 'Error al crear el tema', 'error');
    }
    submitTopicBtn.disabled = false;
    submitTopicBtn.textContent = 'Crear tema';
  });

  // ── Panel crear comentario ──
  const openCommentBtn = document.getElementById('openCreateComment');
  const commentPanel = document.getElementById('createCommentPanel');
  const closeCommentBtn = document.getElementById('closeCreateComment');
  const submitCommentBtn = document.getElementById('submitCreateComment');
  const commentBodyInput = document.getElementById('commentBody');
  const commentBodyCounter = document.getElementById('commentBodyCounter');

  function syncCommentCounters() {
    commentBodyCounter.textContent = commentBodyInput.value.length + ' / 2000';
    const ok = commentBodyInput.value.trim().length >= 1;
    submitCommentBtn.disabled = !ok;
  }

  openCommentBtn.addEventListener('click', () => {
    if (!meRes?.ok) {
      window.location.href = '/src/auth/login.html?msg=crear-comentario';
      return;
    }
    openCommentBtn.style.display = 'none';
    const avatar = openCommentBtn.querySelector('.ct-avatar');
    document.querySelector('#createCommentPanel .create-cat-panel-body').prepend(avatar);
    commentPanel.classList.add('open');
    commentBodyInput.value = '';
    syncCommentCounters();
    setTimeout(() => commentBodyInput.focus(), 50);
  });

  closeCommentBtn.addEventListener('click', () => {
    commentPanel.classList.remove('open');
    const avatar = commentPanel.querySelector('.ct-avatar');
    openCommentBtn.prepend(avatar);
    openCommentBtn.style.display = 'flex';
  });

  commentBodyInput.addEventListener('input', syncCommentCounters);

  submitCommentBtn.addEventListener('click', async () => {
    if (submitCommentBtn.disabled) return;
    submitCommentBtn.disabled = true;
    submitCommentBtn.textContent = 'Publicando...';

    const result = await apiPost('/replies/create', {
      cuerpo: commentBodyInput.value.trim(),
      categoria_id: id
    });

    if (result.ok) {
      const avatar = commentPanel.querySelector('.ct-avatar');
      if (avatar) openCommentBtn.prepend(avatar);
      commentPanel.classList.remove('open');
      openCommentBtn.style.display = 'flex';
      showToast('Comentario publicado', 'success');
      await reloadCurrentView();
    } else {
      showToast(result.message || 'Error al publicar', 'error');
    }
    submitCommentBtn.disabled = false;
    submitCommentBtn.textContent = 'Comentar';
  });
}

document.addEventListener('DOMContentLoaded', loadCategory);