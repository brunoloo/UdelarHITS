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

  // Breadcrumb
  document.getElementById('breadcrumbTitle').textContent = topic.titulo;
  const breadcrumbCat = document.getElementById('breadcrumbCategory');
  breadcrumbCat.textContent = topic.categoria_titulo || 'Categoría';
  breadcrumbCat.href = `/src/category/category.html?id=${encodeURIComponent(topic.categoria_id)}`;

  // Header del tema
  document.getElementById('topicTitle').textContent = topic.titulo;
  const topicBodyEl = document.getElementById('topicBody');
  const topicText = topic.cuerpo || '';
  const TOPIC_CHUNK_CHARS = 750;
  const TOPIC_CHUNK_LINES = 12;
  const topicLines = topicText.split('\n');
  const topicNeedsTruncate = topicText.length > TOPIC_CHUNK_CHARS || topicLines.length > TOPIC_CHUNK_LINES;

  if (topicNeedsTruncate) {
    const byChars = topicText.slice(0, TOPIC_CHUNK_CHARS);
    const byLines = topicLines.slice(0, TOPIC_CHUNK_LINES).join('\n');
    const visible = byChars.length < byLines.length ? byChars : byLines;
    topicBodyEl.textContent = visible + '...';

    const readMoreBtn = document.createElement('button');
    readMoreBtn.className = 'read-more-btn';
    readMoreBtn.textContent = 'Leer más';
    topicBodyEl.after(readMoreBtn);

    readMoreBtn.addEventListener('click', () => {
      const currentText = topicBodyEl.textContent.replace(/\.\.\.$/, '');

      if (currentText === topicText) {
        const truncated = byChars.length < byLines.length ? byChars : byLines;
        topicBodyEl.textContent = truncated + '...';
        readMoreBtn.textContent = 'Leer más';
        return;
      }

      const currentLines = currentText.split('\n').length;
      const allLines = topicText.split('\n');
      const nextByLines = allLines.slice(0, currentLines + TOPIC_CHUNK_LINES).join('\n');
      const nextByChars = topicText.slice(0, currentText.length + TOPIC_CHUNK_CHARS);
      const next = nextByChars.length < nextByLines.length ? nextByChars : nextByLines;

      if (next.length >= topicText.length) {
        topicBodyEl.textContent = topicText;
        readMoreBtn.textContent = 'Leer menos';
      } else {
        topicBodyEl.textContent = next + '...';
      }
    });
  } else {
    topicBodyEl.textContent = topicText;
  }

  // Sidebar autor
  const modList = document.getElementById('modList');
  modList.innerHTML = `
    <div class="mod-item">
      <div class="mod-avatar">
        <img src="${topic.autor_url_imagen || `${SERVER_BASE}/assets/default-user.jpg`}" />
      </div>
      <div class="mod-info">
        <span class="mod-name"><a href="/src/user/profile.html?nickname=${encodeURIComponent(topic.autor_nickname)}">${escapeHtml(topic.autor_nickname)}</a></span>
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
  document.getElementById('sidebarCatName').textContent = topic.categoria_titulo || 'Categoría';

  // Cargar comentarios del tema
  const repliesRes = await apiGet(`/replies/topic/${id}`);
  const comments = repliesRes?.ok ? repliesRes.data : [];
  document.getElementById('statComentarios').textContent = comments.length;

  // Configurar módulo de comentarios
  let meRes = null;
  try { meRes = await apiGet('/users/me'); } catch (e) {}

  setCommentConfig({
    meRes,
    reloadFn: async () => {
      const repliesUpdated = await apiGet(`/replies/topic/${id}`);
      const updatedComments = repliesUpdated?.ok ? repliesUpdated.data : [];
      document.getElementById('statComentarios').textContent = updatedComments.length;
      document.getElementById('topicMeta').innerHTML = `
        <span class="cat-meta-item"><strong>${updatedComments.length}</strong> ${updatedComments.length === 1 ? 'comentario' : 'comentarios'}</span>
        <span class="cat-meta-item">creado <strong>${escapeHtml(timeAgo(topic.fecha_creacion))}</strong></span>
      `;
      renderComments(updatedComments, null);
    }
  });

  renderComments(comments, null);

  // Meta del tema
  const commentCount = comments.length;
  document.getElementById('topicMeta').innerHTML = `
    <span class="cat-meta-item"><strong>${commentCount}</strong> ${commentCount === 1 ? 'comentario' : 'comentarios'}</span>
    <span class="cat-meta-item">creado <strong>${escapeHtml(timeAgo(topic.fecha_creacion))}</strong></span>
  `;

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
    commentBodyCounter.textContent = commentBodyInput.value.length + ' / 2000';
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
}

document.addEventListener('DOMContentLoaded', loadTopic);