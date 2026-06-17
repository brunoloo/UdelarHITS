// ── Historial de ediciones — carrusel ──
let historyEntries = [];
let historyIndex = 0;

function renderHistorySlide() {
  const body = document.getElementById('historyBody');

  if (historyEntries.length === 0) {
    body.innerHTML = `<div class="history-empty">Este tema no tiene ediciones anteriores.</div>`;
    return;
  }

  const entry = historyEntries[historyIndex];
  const total = historyEntries.length;

  body.innerHTML = `
    <div class="history-carousel">
      <div class="history-header">
        <span class="history-counter">${historyIndex + 1} de ${total}</span>
        <span class="history-date">${escapeHtml(timeAgo(entry.fecha_edicion))}</span>
      </div>
      <div class="history-content">
        <p class="history-label">Contenido anterior</p>
        <div class="history-text">${escapeHtml(entry.contenido_anterior)}</div>
      </div>
      <div class="history-nav">
        <button class="history-arrow" id="historyPrev" ${historyIndex >= total - 1 ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button class="history-arrow" id="historyNext" ${historyIndex <= 0 ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  `;

  document.getElementById('historyPrev').addEventListener('click', () => {
    if (historyIndex < total - 1) { historyIndex++; renderHistorySlide(); }
  });
  document.getElementById('historyNext').addEventListener('click', () => {
    if (historyIndex > 0) { historyIndex--; renderHistorySlide(); }
  });
}

function openHistoryModal() {
  document.getElementById('historyModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadTopic() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = '/';
    return;
  }

  // Cargar datos del tema
  const res = await apiGet(`/topics/${id}`);

  if (!res?.ok) {
    window.showToast && window.showToast('Tema no encontrado', 'error');
    window.location.href = '/';
    return;
  }

  const topic = res.data;

  // Título de la página
  document.title = `${topic.titulo} — UdelarHITS`;

  
  let meRes = null;
  try { meRes = await apiGet('/users/me'); } catch (e) {}
  const isOwner = meRes?.ok && (meRes.data.user.id === topic.autor_id || meRes.data.user.rol === 'admin');

  const catInactiva = topic.categoria_estado === 'inactiva';

  // Breadcrumb
  const breadcrumbCat = document.getElementById('breadcrumbCategory');
  breadcrumbCat.textContent = catInactiva ? 'Categoría inactiva' : (topic.categoria_titulo || 'Categoría');
  breadcrumbCat.href = `/src/category/category.html?id=${encodeURIComponent(topic.categoria_id)}`;

  if (topic.estado === 'inactivo') {
    // Banner informativo en lugar del header
    document.querySelector('.topic-header').innerHTML = `
      <div class="cat-inactive-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="cat-inactive-text">
          <span class="cat-inactive-title">Este tema ya no está disponible</span>
          <span class="cat-inactive-desc">El contenido publicado se preserva por la <a href="/src/about/content_policies.html" target="_blank">política de preservación de contenido</a>.</span>
        </div>
      </div>
    `;

    // Ocultar sidebar
    document.querySelector('.sidebar').style.display = 'none';

    // Ocultar trigger de crear comentario
    document.querySelectorAll('.create-topic').forEach(el => el.style.display = 'none');

    // Breadcrumb genérico
    document.getElementById('breadcrumbTitle').textContent = 'Tema inactivo';
    document.title = 'Tema inactivo — UdelarHITS';

  } else {
    // Header normal
    document.getElementById('breadcrumbTitle').textContent = topic.titulo;
    document.getElementById('topicTitle').textContent = topic.titulo;
    initReadMore(document.getElementById('topicBody'), topic.cuerpo || '');
    // Menú de reporte del tema
    if (topic.estado !== 'inactivo') {
      document.getElementById('topicMenuWrap').style.display = '';

      const topicMenuBtn = document.querySelector('#topicMenuWrap .comment-menu-btn');
      const topicDropdown = document.getElementById('topicDropdown');

      topicMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        topicDropdown.classList.toggle('open');
      });

      document.addEventListener('click', () => {
        topicDropdown.classList.remove('open');
      });

      // Reportar tema
      document.getElementById('reportTopicBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      topicDropdown.classList.remove('open');
      if (meRes?.ok && meRes.data.user.id === topic.autor_id) {
        showToast('No podés reportar tu propio contenido', 'error');
        return;
      }
      openReportModal(id);
    });

    // Historial de ediciones
    document.getElementById('historyTopicBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      topicDropdown.classList.remove('open');

      const histRes = await apiGet(`/topics/${id}/history`);
      historyEntries = histRes?.ok ? histRes.data : [];
      historyIndex = 0;
      renderHistorySlide();
      openHistoryModal();
    });

    document.getElementById('closeHistoryModal').addEventListener('click', closeHistoryModal);
    }
  }

  if (topic.estado !== 'inactivo') {
    // Sidebar autor
    const modList = document.getElementById('modList');
    const autorDisplay = getAutorDisplay(topic);

    modList.innerHTML = `
      <div class="mod-item">
        <div class="mod-avatar">
          <img src="${autorDisplay.avatar}" />
        </div>
        <div class="mod-info">
          ${autorDisplay.isInactive
            ? `<span class="mod-name inactive-author">${escapeHtml(autorDisplay.nickname)}</span>`
            : `<span class="mod-name"><a href="${autorDisplay.profileLink}">${escapeHtml(autorDisplay.nickname)}</a></span>`}
          <span class="mod-role">creador</span>
        </div>
      </div>
`;

    modList.querySelectorAll('.mod-avatar img').forEach(img => {
      img.addEventListener('error', () => {
        img.src = SERVER_BASE + '/assets/default-user.jpg';
      });
    });

    // Sidebar stats
    document.getElementById('statCreado').textContent = new Date(topic.fecha_creacion).toLocaleDateString('es-UY');

    // Sidebar categoría
    const catLink = document.getElementById('sidebarCatLink');
    catLink.href = `/src/category/category.html?id=${encodeURIComponent(topic.categoria_id)}`;
    document.getElementById('sidebarCatName').textContent = catInactiva ? 'Categoría inactiva' : (topic.categoria_titulo || 'Categoría');
  }

  // Cargar comentarios del tema
  const repliesRes = await apiGet(`/replies/topic/${id}`);
  const comments = repliesRes?.ok ? repliesRes.data : [];
  document.getElementById('statComentarios').textContent = comments.length;
  document.getElementById('countComentarios').textContent = comments.length;


  setCommentConfig({
    meRes,
    reloadFn: async () => {
      const repliesUpdated = await apiGet(`/replies/topic/${id}`);
      const updatedComments = repliesUpdated?.ok ? repliesUpdated.data : [];
      const statEl = document.getElementById('statComentarios');
      if (statEl) statEl.textContent = updatedComments.length;
      const countEl = document.getElementById('countComentarios');
      if (countEl) countEl.textContent = updatedComments.length;
      const metaEl = document.getElementById('topicMeta');
      if (metaEl) {
        const countSpan = metaEl.querySelector('.cat-meta-item strong');
        if (countSpan) {
          countSpan.textContent = updatedComments.length;
          countSpan.nextSibling.textContent = ` ${updatedComments.length === 1 ? 'comentario' : 'comentarios'}`;
        }
      }
      renderComments(updatedComments, null);
    }
  });

  renderComments(comments, null);

  // Meta del tema
  const commentCount = comments.length;
  if (topic.estado !== 'inactivo') {
    const editBtnHtml = isOwner
      ? `<button class="btn-ghost" id="editTopicBtn">Editar tema</button>`
      : '';

    document.getElementById('topicMeta').innerHTML = `
      <span class="cat-meta-item"><strong>${commentCount}</strong> ${commentCount === 1 ? 'comentario' : 'comentarios'}</span>
      <span class="cat-meta-item">creado <strong>${escapeHtml(timeAgo(topic.fecha_creacion))}</strong></span>
      ${editBtnHtml}
    `;
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

  // ── Panel crear comentario (nivel raíz) ──
  const openCommentBtn = document.getElementById('openCreateComment');
  const commentPanel = document.getElementById('createCommentPanel');
  const closeCommentBtn = document.getElementById('closeCreateComment');
  const submitCommentBtn = document.getElementById('submitCreateComment');
  const commentBodyInput = document.getElementById('commentBody');
  const commentBodyCounter = document.getElementById('commentBodyCounter');

  function syncCommentCounters() {
    commentBodyCounter.textContent = commentBodyInput.value.length + ' / 5000';
    submitCommentBtn.disabled = commentBodyInput.value.trim().length < 1;
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
      tema_id: id
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
  // ── Editar y eliminar tema ──
  if (isOwner && topic.estado !== 'inactivo') {
    const editTopicModal = document.getElementById('editTopicModal');
    const closeTopicModal = document.getElementById('closeTopicModal');
    const editTopicBody = document.getElementById('editTopicBody');
    const editTopicBodyCounter = document.getElementById('editTopicBodyCounter');
    const saveTopicBtn = document.getElementById('saveTopicBtn');

    function syncEditTopicBtn() {
      editTopicBodyCounter.textContent = editTopicBody.value.length + ' / 750';
      saveTopicBtn.disabled = editTopicBody.value.trim().length < 1;
    }

    function openEditTopicModal() {
      editTopicBody.value = topic.cuerpo || '';
      syncEditTopicBtn();
      editTopicModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeEditTopicModal() {
      editTopicModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.getElementById('editTopicBtn').addEventListener('click', openEditTopicModal);
    closeTopicModal.addEventListener('click', closeEditTopicModal);
    editTopicBody.addEventListener('input', syncEditTopicBtn);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('confirmDeleteModal').classList.contains('open')) {
          closeConfirmModal();
        } else if (editTopicModal.classList.contains('open')) {
          closeEditTopicModal();
        }
      }
    });

    saveTopicBtn.addEventListener('click', async () => {
      if (saveTopicBtn.disabled) return;
      saveTopicBtn.disabled = true;
      saveTopicBtn.textContent = 'Guardando...';

      const result = await apiPatch(`/topics/${id}`, {
        cuerpo: editTopicBody.value.trim()
      });

      if (result.ok) {
        closeEditTopicModal();
        showToast('Tema actualizado', 'success');
        topic.cuerpo = editTopicBody.value.trim();
        initReadMore(document.getElementById('topicBody'), topic.cuerpo);
      } else {
        showToast(result.message || 'Error al guardar', 'error');
      }

      saveTopicBtn.disabled = false;
      saveTopicBtn.textContent = 'Guardar';
    });

    // ── Eliminar tema ──
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const closeConfirmDelete = document.getElementById('closeConfirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    function openConfirmModal() {
      editTopicModal.classList.remove('open');
      confirmDeleteModal.classList.add('open');
    }

    function closeConfirmModal() {
      confirmDeleteModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.getElementById('deleteTopicBtn').addEventListener('click', openConfirmModal);
    closeConfirmDelete.addEventListener('click', closeConfirmModal);
    cancelDeleteBtn.addEventListener('click', closeConfirmModal);

    confirmDeleteBtn.addEventListener('click', async () => {
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Eliminando...';

      const result = await apiDelete(`/topics/${id}/delete`);

      if (result.ok) {
        closeConfirmModal();
        showToast(result.message || 'Tema eliminado', 'success');
        setTimeout(() => { window.location.href = `/src/category/category.html?id=${encodeURIComponent(topic.categoria_id)}`; }, 2000);
      } else {
        showToast(result.message || 'Error al eliminar', 'error');
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Eliminar tema';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', loadTopic);