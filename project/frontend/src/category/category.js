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
    <div class="topic-card" data-topic-id="${encodeURIComponent(t.contenido_id)}">
      <img class="topic-avatar"
          src="${t.autor_url_imagen || (SERVER_BASE + '/assets/default-user.jpg')}"
          alt="${escapeHtml(t.autor_nickname)}" />
      <div class="topic-body">
        <div class="topic-head">
          <a href="/src/user/profile.html?nickname=${encodeURIComponent(t.autor_nickname)}">${escapeHtml(t.autor_nickname)}</a>
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
    </div>
  `;
  }).join('');

  // Fallback de avatares
  feed.querySelectorAll('.topic-avatar').forEach(img => {
    img.addEventListener('error', () => {
      img.src = SERVER_BASE + '/assets/default-user.jpg';
    });
  });

  feed.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // ignorar click en el link del autor
      window.location.href = `/src/topic/topic.html?id=${card.dataset.topicId}`;
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

  let cat = res.data;

  // Configurar módulo de comentarios
  let meRes = null;
  try { meRes = await apiGet('/users/me'); } catch (e) {}
  // ── Editar y eliminar categoría ──
  const isOwner = meRes?.ok && (meRes.data.user.id === cat.autor_id || meRes.data.user.rol === 'admin');
  
  // Breadcrumb
  document.getElementById('breadcrumbTitle').textContent = cat.titulo;
  document.title = `${cat.titulo} — UdelarHITS`;
  
  const count = Number(cat.contador_temas) || 0;
  if (cat.estado === 'inactiva') {
    // Reemplazar header completo por banner informativo
    document.querySelector('.cat-header').innerHTML = `
      <div class="cat-inactive-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="cat-inactive-text">
          <span class="cat-inactive-title">Esta categoría ya no está disponible</span>
          <span class="cat-inactive-desc">El contenido publicado se preserva por la <a href="/src/about/content_policies.html" target="_blank">política de preservación de contenido</a>.</span>
        </div>
      </div>
    `;

    // Ocultar sidebar de moderación y stats
    document.querySelector('.sidebar').style.display = 'none';

    // Ocultar triggers de crear contenido
    document.querySelectorAll('.create-topic').forEach(el => el.style.display = 'none');

    // Breadcrumb genérico
    document.getElementById('breadcrumbTitle').textContent = 'Categoría inactiva';
    document.title = 'Categoría inactiva — UdelarHITS';

  } else {
    // Header normal
    document.getElementById('catTitle').textContent = cat.titulo;
    initReadMore(document.getElementById('catDesc'), cat.descripcion || ''); 

    // Etiquetas
    const etiquetas = parseEtiquetas(cat.etiquetas);
    document.getElementById('catTags').innerHTML = etiquetas
      .map(e => `<span class="tag">${escapeHtml(e)}</span>`)
      .join('');

    // Meta + botón editar
    const editBtnHtml = isOwner
      ? `<button class="btn-ghost" id="editCatBtn">Editar categoría</button>`
      : '';

    document.getElementById('catMeta').innerHTML = `
      <span class="cat-meta-item"><strong>${count}</strong> ${count === 1 ? 'tema' : 'temas'}</span>
      <span class="cat-meta-item">creada <strong>${escapeHtml(timeAgo(cat.fecha_creacion))}</strong></span>
      ${editBtnHtml}
    `;

    // Menú de reporte de la categoría
    document.getElementById('catMenuWrap').style.display = '';

    const catMenuBtn = document.querySelector('#catMenuWrap .comment-menu-btn');
    const catDropdown = document.getElementById('catDropdown');

    catMenuBtn.addEventListener('click', (e) => { 
      e.stopPropagation();
      catDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      catDropdown.classList.remove('open');
    });

    document.getElementById('reportCatBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      catDropdown.classList.remove('open');
      showToast('Función de reportar próximamente', 'info');
    });
  }

  // Sidebar stats
  if (cat.estado !== 'inactiva') {
    document.getElementById('statTemas').textContent = count;
    document.getElementById('statCreada').textContent = new Date(cat.fecha_creacion).toLocaleDateString('es-UY');
  }

  // Temas
  if (cat.topics) {
    renderTopics(cat.topics);
  }

  // Comentarios
  const repliesRes = await apiGet(`/replies/category/${id}`);
  const commentCount = repliesRes?.ok ? repliesRes.data.length : 0;
  document.getElementById('statComentarios').textContent = commentCount;

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
  if (cat.estado !== 'inactiva'){
    const modList = document.getElementById('modList');
    modList.innerHTML = `
      <div class="mod-item">
        <div class="mod-avatar">
          <img src="${cat.autor_url_imagen || (SERVER_BASE + '/assets/default-user.jpg')}" alt="" />
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
  }

  // Avatar de los triggers
  const ctAvatars = document.querySelectorAll('.ct-avatar');
  if (meRes?.ok) {
    ctAvatars.forEach(ctAvatar => {
      const img = document.createElement('img');
      img.src = meRes.data.user.url_imagen || `${SERVER_BASE}/assets/default-user.jpg`;
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
    if (!meRes?.ok) {
      window.location.href = '/src/auth/login.html?msg=crear-tema';
      return;
    }
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
    commentBodyCounter.textContent = commentBodyInput.value.length + ' / 5000';
    const ok = commentBodyInput.value.trim().length >= 1;
    submitCommentBtn.disabled = !ok;
  }

  openCommentBtn.addEventListener('click', () => {
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
    if (!meRes?.ok) {
      window.location.href = '/src/auth/login.html?msg=crear-comentario';
      return;
    }
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


  if (isOwner && cat.estado !== 'inactiva') {
    const editCatModal = document.getElementById('editCatModal');
    const closeCatModal = document.getElementById('closeCatModal');
    const editCatDesc = document.getElementById('editCatDesc');
    const editCatDescCounter = document.getElementById('editCatDescCounter');
    const editCatTagsCounter = document.getElementById('editCatTagsCounter');
    const saveCatBtn = document.getElementById('saveCatBtn');
    const editTagsSelector = document.getElementById('editTagsSelector');

    let editSelectedTags = [];
    let editAvailableTags = [];

    // Cargar etiquetas disponibles
    async function loadEditTags() {
      const res = await apiGet('/categories/etiquetas');
      if (res?.ok) editAvailableTags = res.data;
    }

    function renderEditTags() {
      editTagsSelector.innerHTML = editAvailableTags.map(tag =>
        `<button type="button" class="tag-option${editSelectedTags.includes(tag) ? ' selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
      ).join('');

      editTagsSelector.querySelectorAll('.tag-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          if (editSelectedTags.includes(tag)) {
            editSelectedTags = editSelectedTags.filter(t => t !== tag);
            btn.classList.remove('selected');
          } else if (editSelectedTags.length < 10) {
            editSelectedTags.push(tag);
            btn.classList.add('selected');
          }
          editCatTagsCounter.textContent = editSelectedTags.length + ' / 10';
          syncEditCatBtn();
        });
      });
    }

    function syncEditCatBtn() {
      editCatDescCounter.textContent = editCatDesc.value.length + ' / 500';
      editCatTagsCounter.textContent = editSelectedTags.length + ' / 10';
      const ok = editCatDesc.value.trim().length >= 1 && editSelectedTags.length >= 1;
      saveCatBtn.disabled = !ok;
    }

    function openEditCatModal() {
      editCatDesc.value = cat.descripcion || '';
      editSelectedTags = parseEtiquetas(cat.etiquetas).slice();
      syncEditCatBtn();
      renderEditTags();
      editCatModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeEditCatModal() {
      editCatModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.getElementById('editCatBtn').addEventListener('click', openEditCatModal);
    closeCatModal.addEventListener('click', closeEditCatModal);
    editCatDesc.addEventListener('input', syncEditCatBtn);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('confirmDeleteModal').classList.contains('open')) {
          closeConfirmModal();
        } else if (editCatModal.classList.contains('open')) {
          closeEditCatModal();
        }
      }
    });

    // Guardar cambios
    saveCatBtn.addEventListener('click', async () => {
      if (saveCatBtn.disabled) return;
      saveCatBtn.disabled = true;
      saveCatBtn.textContent = 'Guardando...';

      const result = await apiPatch(`/categories/${id}`, {
        descripcion: editCatDesc.value.trim(),
        etiquetas: editSelectedTags
      });

      if (result.ok) {
        closeEditCatModal();
        showToast('Categoría actualizada', 'success');

        // Actualizar la vista sin recargar la página
        const updated = await apiGet(`/categories/${id}`);
        if (updated?.ok) {
          cat = updated.data;
          document.getElementById('catTitle').textContent = cat.titulo;
          initReadMore(document.getElementById('catDesc'), cat.descripcion || '');
          const etiquetas = parseEtiquetas(cat.etiquetas);
          document.getElementById('catTags').innerHTML = etiquetas
            .map(e => `<span class="tag">${escapeHtml(e)}</span>`)
            .join('');
        }
      } else {
        showToast(result.message || 'Error al guardar', 'error');
      }

      saveCatBtn.disabled = false;
      saveCatBtn.textContent = 'Guardar';
    });

    // Cargar etiquetas al inicio
    loadEditTags();

    // ── Eliminar categoría ──
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const closeConfirmDelete = document.getElementById('closeConfirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    function openConfirmModal() {
      editCatModal.classList.remove('open');
      confirmDeleteModal.classList.add('open');
    }

    function closeConfirmModal() {
      confirmDeleteModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.getElementById('deleteCatBtn').addEventListener('click', openConfirmModal);
    closeConfirmDelete.addEventListener('click', closeConfirmModal);
    cancelDeleteBtn.addEventListener('click', closeConfirmModal);

    confirmDeleteBtn.addEventListener('click', async () => {
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Eliminando...';

      const result = await apiDelete(`/categories/${id}/delete`);

      if (result.ok) {
        closeConfirmModal();
        showToast(result.message || 'Categoría eliminada', 'success');
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        showToast(result.message || 'Error al eliminar', 'error');
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Eliminar categoría';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', loadCategory);