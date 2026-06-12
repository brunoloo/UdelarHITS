// ── Comentarios compartidos ──
// Usado por topic.js y category.js
//
// Modelo:
//   - commentStack es el camino de ancestros clickeados (raíz → ... → header actual).
//   - Render dibuja TODA la pila apilada verticalmente, con un hilo conector entre niveles,
//     y debajo las respuestas directas al último ancestro (header actual).
//   - Click en el panel de un comentario de la lista de respuestas → profundiza un nivel.
//   - Click en Responder → abre panel inline (no profundiza).
//   - Click en "Volver" → pop del stack.
//   - Los ancestros NO son clickeables para profundizar. Mantienen Responder y "X respuestas"
//     (este último como display informativo, sin acción).


const INITIAL_LINES = 8;
const EXPAND_LINES = 12;
const INITIAL_CHARS = 500;
const EXPAND_CHARS = 750;

let commentStack = [];
let currentMeRes = null;
let rootReloadFn = null; // cada página setea esto

function setCommentConfig({ meRes, reloadFn }) {
  currentMeRes = meRes;
  rootReloadFn = reloadFn;
}

function truncateText(texto) {
  const lines = texto.split('\n');
  const needsTruncateLines = lines.length > INITIAL_LINES;
  const needsTruncateChars = texto.length > INITIAL_CHARS;

  if (!needsTruncateLines && !needsTruncateChars) return { visible: texto, truncated: false };

  if (needsTruncateLines) {
    return { visible: lines.slice(0, INITIAL_LINES).join('\n') + '...', truncated: true, mode: 'lines' };
  }

  return { visible: texto.slice(0, INITIAL_CHARS) + '...', truncated: true, mode: 'chars' };
}

// ──────────────────────────────────────────────
// Render de un comentario (template reutilizable)
// ──────────────────────────────────────────────
// role: 'ancestor' | 'reply'
//   - ancestor: parte del camino, NO clickeable para profundizar, sin acción.
//   - reply: respuesta directa, clickeable para profundizar.
// index: posición dentro de su grupo (para IDs únicos del "Leer más").
// indexPrefix: 'a' para ancestros, 'r' para replies (evita colisión de IDs).
function renderCommentCard(c, role, index, indexPrefix) {
  // Comentario oculto → placeholder
  if (c.estado === 'oculto') {
    const replyCount = Number(c.contador_respuestas) || 0;
    const hiddenText = c.motivo_inactivacion === 'moderacion_reporte'
      ? 'Este comentario fue ocultado por la comunidad'
      : 'Este comentario fue eliminado por su autor';
    const cardClasses = ['comment-card', 'comment-card--hidden'];
    if (role === 'ancestor') cardClasses.push('comment-card--ancestor');
    if (role === 'reply' && replyCount > 0) cardClasses.push('comment-card--clickable');

    const dataAttrs = role === 'reply'
      ? `data-comment-id="${c.id}" data-author="" data-body="" data-date="${c.fecha_creacion}" data-autor-id="" data-autor-url="" data-reply-count="${replyCount}" data-estado="oculto"`
      : `data-comment-id="${c.id}"`;

    const repliesBtnHtml = replyCount > 0
      ? `<span class="comment-action-info">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
           ${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}
         </span>`
      : '';

    return `
      <div class="${cardClasses.join(' ')}" ${dataAttrs}>
        <div class="comment-gutter">
          <div class="comment-avatar"></div>
        </div>
        <div class="comment-body">
          <div class="comment-hidden-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${hiddenText}
          </div>
          ${replyCount > 0 ? `<div class="comment-actions">${repliesBtnHtml}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Comentario visible (lógica normal)
  const texto = c.cuerpo || '';
  const result = truncateText(texto);
  const { visible, truncated } = result;
  const mode = result.mode || 'lines';
  const replyCount = Number(c.contador_respuestas) || 0;
  const textId = `comment-text-${indexPrefix}-${index}`;

  const cardClasses = ['comment-card'];
  if (role === 'ancestor') cardClasses.push('comment-card--ancestor');
  if (role === 'reply') cardClasses.push('comment-card--clickable');

  const dataAttrs = role === 'reply'
    ? `data-comment-id="${c.id}" data-author="${escapeHtml(c.autor_nickname)}" data-body="${escapeHtml(c.cuerpo)}" data-date="${c.fecha_creacion}" data-autor-id="${c.autor_id}" data-autor-url="${c.autor_url_imagen || ''}" data-reply-count="${replyCount}" data-estado="visible"`
    : `data-comment-id="${c.id}"`;

  const repliesBtnHtml = replyCount > 0
    ? `<span class="comment-action-info">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
         ${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}
       </span>`
    : '';

  // Menú de tres puntos
  const isAuthor = currentMeRes?.ok && currentMeRes.data.user.id == c.autor_id;
  const isAdmin = currentMeRes?.ok && currentMeRes.data.user.rol === 'admin';
  const canDelete = isAuthor || isAdmin;

  const editOption = isAuthor
    ? `<button class="comment-dropdown-item edit-comment-btn" data-comment-id="${c.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar comentario
      </button>`
    : '';

  const deleteOption = canDelete
    ? `<button class="comment-dropdown-item comment-dropdown-item--danger delete-comment-btn" data-comment-id="${c.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Eliminar comentario
      </button>`
    : '';

  const menuHtml = `
    <div class="comment-menu-wrap">
      <button class="comment-menu-btn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
      <div class="comment-dropdown">
        <button class="comment-dropdown-item report-comment-btn" data-comment-id="${c.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          Reportar
        </button>
        ${editOption}
        ${deleteOption}
      </div>
    </div>
  `;

  return `
    <div class="${cardClasses.join(' ')}" ${dataAttrs}>
      <div class="comment-gutter">
        <img class="comment-avatar"
             src="${c.autor_url_imagen || (SERVER_BASE + '/assets/default-user.jpg')}"
             alt="${escapeHtml(c.autor_nickname)}" />
      </div>
      <div class="comment-body">
        <div class="comment-head">
          <a href="/src/user/profile.html?nickname=${encodeURIComponent(c.autor_nickname)}">${escapeHtml(c.autor_nickname)}</a>
          <span>·</span>
          <span>${escapeHtml(timeAgo(c.fecha_creacion))}</span>
          ${menuHtml}
        </div>
        <div class="comment-text" id="${textId}" data-full="${escapeAttr(texto)}" data-mode="${truncated ? mode : ''}" data-visible="${truncated ? (mode === 'lines' ? INITIAL_LINES : INITIAL_CHARS) : 0}">${renderizarBioConLinks(visible)}</div>
        ${truncated ? `<button class="read-more-btn" data-text-id="${textId}">Leer más</button>` : ''}
        <div class="comment-actions">
          <button class="comment-action-btn reply-btn" data-comment-id="${c.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Responder
          </button>
          ${repliesBtnHtml}
        </div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────
// Render principal
// ──────────────────────────────────────────────
// `comments` son las respuestas directas al último ancestro (o las respuestas raíz si stack está vacío).
// `parentComment` se mantiene en la firma por compat con el código existente, pero ya no se usa:
// la pila completa se lee de `commentStack`.
function renderComments(comments, _parentComment) {
  const feed = document.getElementById('commentsFeed');

  let html = '';

  // Botón volver si estamos en profundidad
  if (commentStack.length > 0) {
    html += `
      <button class="back-btn" id="backBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </button>
    `;
  }

  // Pila de ancestros (camino raíz → header actual)
  if (commentStack.length > 0) {
    html += `<div class="comment-thread">`;
    html += commentStack.map((anc, i) =>
      renderCommentCard(anc, 'ancestor', i, 'a')
    ).join('');
    html += `</div>`;
  }

  // Lista de respuestas directas (al último ancestro, o al tema/categoría si stack vacío)
  if (!comments || comments.length === 0) {
    if (commentStack.length === 0) {
      html += `<div class="feed-empty">Todavía no hay comentarios. ¡Sé el primero!</div>`;
    } else {
      html += `<div class="feed-empty">No hay respuestas a este comentario.</div>`;
    }
  } else {
    html += `<div class="comment-replies">`;
    html += comments.map((c, i) => renderCommentCard(c, 'reply', i, 'r')).join('');
    html += `</div>`;
  }

  feed.innerHTML = html;

  attachBackListener();
  attachReadMoreListeners(feed);
  attachMenuListeners(feed);
  attachAvatarFallbacks(feed);
  attachReplyListeners(feed);
  attachCommentClickListeners(feed);
}

function attachBackListener() {
  const backBtn = document.getElementById('backBtn');
  if (!backBtn) return;

  backBtn.addEventListener('click', async () => {
    commentStack.pop();
    if (commentStack.length === 0) {
      if (rootReloadFn) await rootReloadFn();
    } else {
      const prev = commentStack[commentStack.length - 1];
      const repliesRes = await apiGet(`/replies/${prev.id}/replies`);
      const comments = repliesRes?.ok ? repliesRes.data : [];
      renderComments(comments, prev);
    }
  });
}

function attachReadMoreListeners(container) {
  container.querySelectorAll('.read-more-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textId = btn.dataset.textId;
      const el = document.getElementById(textId);
      if (!el) return;

      const fullText = el.dataset.full;
      const mode = el.dataset.mode;
      const currentVisible = parseInt(el.dataset.visible) || 0;

      if (mode === 'lines') {
        const allLines = fullText.split('\n');

        // Si ya está completamente expandido, colapsar
        if (currentVisible >= allLines.length) {
          el.dataset.visible = INITIAL_LINES;
          el.innerHTML = renderizarBioConLinks(allLines.slice(0, INITIAL_LINES).join('\n') + '...');
          btn.textContent = 'Leer más';
          return;
        }

        const nextLines = Math.min(currentVisible + EXPAND_LINES, allLines.length);
        el.dataset.visible = nextLines;

        if (nextLines >= allLines.length) {
          el.innerHTML = renderizarBioConLinks(fullText);
          btn.textContent = 'Leer menos';
        } else {
          el.innerHTML = renderizarBioConLinks(allLines.slice(0, nextLines).join('\n') + '...');
        }

      } else {
        // mode === 'chars'

        // Si ya está completamente expandido, colapsar
        if (currentVisible >= fullText.length) {
          el.dataset.visible = INITIAL_CHARS;
          el.innerHTML = renderizarBioConLinks(fullText.slice(0, INITIAL_CHARS) + '...');
          btn.textContent = 'Leer más';
          return;
        }

        const nextChars = Math.min(currentVisible + EXPAND_CHARS, fullText.length);
        el.dataset.visible = nextChars;

        if (nextChars >= fullText.length) {
          el.innerHTML = renderizarBioConLinks(fullText);
          btn.textContent = 'Leer menos';
        } else {
          el.innerHTML = renderizarBioConLinks(fullText.slice(0, nextChars) + '...');
        }
      }
    });
  });
}

function attachMenuListeners(container) {
  // Toggle del dropdown
  container.querySelectorAll('.comment-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = btn.nextElementSibling;
      // Cerrar todos los demás
      container.querySelectorAll('.comment-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
    });
  });

  // Cerrar dropdowns al clickear fuera
  document.addEventListener('click', () => {
    container.querySelectorAll('.comment-dropdown.open').forEach(d => d.classList.remove('open'));
  });

  // Reportar comentario
  container.querySelectorAll('.report-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.closest('.comment-dropdown').classList.remove('open');
      const card = btn.closest('.comment-card');
      if (currentMeRes?.ok && currentMeRes.data.user.id == card.dataset.autorId) {
        showToast('No podés reportar tu propio contenido', 'error');
        return;
      }
      openReportModal(btn.dataset.commentId);
    });
  });

  // Eliminar comentario
  container.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.closest('.comment-dropdown').classList.remove('open');

      const commentId = btn.dataset.commentId;
      const result = await apiDelete(`/replies/delete/${commentId}`);

      if (result.ok) {
        showToast(result.message || 'Comentario eliminado', 'success');
        await reloadCurrentView();
      } else {
        showToast(result.message || 'Error al eliminar', 'error');
      }
    });
  });

  // Editar comentario
  container.querySelectorAll('.edit-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.closest('.comment-dropdown').classList.remove('open');

      const commentId = btn.dataset.commentId;
      const card = btn.closest('.comment-card');
      const bodyEl = card.querySelector('.comment-body');
      const textEl = card.querySelector('.comment-text');
      const readMoreBtn = card.querySelector('.read-more-btn');
      const actionsEl = card.querySelector('.comment-actions');

      // Obtener texto original
      const originalText = textEl.dataset.full || textEl.textContent;

      // Ocultar elementos actuales
      textEl.style.display = 'none';
      if (readMoreBtn) readMoreBtn.style.display = 'none';
      actionsEl.style.display = 'none';

      // Crear panel de edición
      const panel = document.createElement('div');
      panel.className = 'inline-reply-panel';
      panel.innerHTML = `
        <div class="edit-field">
          <div class="edit-field-label">
            <span>Editar comentario</span>
            <span class="edit-field-counter inline-edit-counter">${originalText.length} / 5000</span>
          </div>
          <textarea class="inline-reply-input" maxlength="5000" rows="4">${escapeHtml(originalText)}</textarea>
        </div>
        <div class="inline-reply-actions">
          <button class="cc-cancel inline-edit-cancel">Cancelar</button>
          <button class="save-btn inline-edit-submit">Guardar</button>
        </div>
      `;

      // Insertar después del comment-head
      const headEl = card.querySelector('.comment-head');
      headEl.after(panel);

      const input = panel.querySelector('.inline-reply-input');
      const counter = panel.querySelector('.inline-edit-counter');
      const submitBtn = panel.querySelector('.inline-edit-submit');
      const cancelBtn = panel.querySelector('.inline-edit-cancel');

      panel.addEventListener('click', (e) => e.stopPropagation());

      input.focus();
      // Mover cursor al final
      input.setSelectionRange(input.value.length, input.value.length);

      input.addEventListener('input', () => {
        counter.textContent = input.value.length + ' / 5000';
        submitBtn.disabled = input.value.trim().length < 1;
      });

      cancelBtn.addEventListener('click', () => {
        panel.remove();
        textEl.style.display = '';
        if (readMoreBtn) readMoreBtn.style.display = '';
        actionsEl.style.display = '';
      });

      submitBtn.addEventListener('click', async () => {
        if (input.value.trim().length < 1) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        const result = await apiPatch(`/replies/update/${commentId}`, {
          cuerpo: input.value.trim()
        });

        if (result.ok) {
          showToast('Comentario actualizado', 'success');
          await reloadCurrentView();
        } else {
          showToast(result.message || 'Error al editar', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar';
        }
      });
    });
  });
}

function attachAvatarFallbacks(container) {
  container.querySelectorAll('.comment-avatar').forEach(img => {
    img.addEventListener('error', () => {
      img.src = SERVER_BASE + '/assets/default-user.jpg';
    });
  });
}

function attachReplyListeners(container) {
  container.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;

      const card = btn.closest('.comment-card');
      const existingPanel = card.querySelector('.inline-reply-panel');
      if (existingPanel) {
        existingPanel.remove();
        return;
      }

      const panel = document.createElement('div');
      panel.className = 'inline-reply-panel';
      panel.innerHTML = `
        <div class="edit-field">
          <div class="edit-field-label">
            <span>Respuesta (*)</span>
            <span class="edit-field-counter inline-reply-counter">0 / 5000</span>
          </div>
          <textarea class="inline-reply-input" maxlength="5000" rows="3" placeholder="Escribí tu respuesta"></textarea>
        </div>
        <div class="inline-reply-actions">
          <button class="cc-cancel inline-reply-cancel">Cancelar</button>
          <button class="save-btn inline-reply-submit" disabled>Responder</button>
        </div>
      `;

      card.querySelector('.comment-body').appendChild(panel);

      const input = panel.querySelector('.inline-reply-input');
      const counter = panel.querySelector('.inline-reply-counter');
      const submitBtn = panel.querySelector('.inline-reply-submit');
      const cancelBtn = panel.querySelector('.inline-reply-cancel');

      // Evitar que clicks dentro del panel propaguen al card
      panel.addEventListener('click', (e) => e.stopPropagation());

      input.focus();

      input.addEventListener('input', () => {
        counter.textContent = input.value.length + ' / 5000';
        submitBtn.disabled = input.value.trim().length < 1;
      });

      cancelBtn.addEventListener('click', () => panel.remove());

      submitBtn.addEventListener('click', async () => {
        if (!currentMeRes?.ok) {
          window.location.href = '/src/auth/login.html?msg=crear-comentario';
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publicando...';

        const result = await apiPost('/replies/create', {
          cuerpo: input.value.trim(),
          comentario_padre_id: commentId
        });

        if (result.ok) {
          panel.remove();
          showToast('Respuesta publicada', 'success');
          await reloadCurrentView();
        } else {
          showToast(result.message || 'Error al publicar', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Responder';
        }
      });
    });
  });
}

function attachCommentClickListeners(container) {
  // Solo los comentarios marcados como .comment-card--clickable (replies) profundizan.
  // Los ancestros (.comment-card--ancestor) no responden a click sobre el card.
  container.querySelectorAll('.comment-card--clickable').forEach(card => {
    card.addEventListener('click', async (e) => {
      // No profundizar si clickearon un link, botón o el panel de respuesta inline
      if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.inline-reply-panel')) return;

      const commentId = card.dataset.commentId;
      const parentComment = {
        id: commentId,
        autor_nickname: card.dataset.author,
        cuerpo: card.dataset.body,
        fecha_creacion: card.dataset.date,
        autor_id: card.dataset.autorId,
        autor_url_imagen: card.dataset.autorUrl || '',
        contador_respuestas: Number(card.dataset.replyCount) || 0,
        estado: card.dataset.estado || 'visible'
      };

      commentStack.push(parentComment);

      const repliesRes = await apiGet(`/replies/${commentId}/replies`);
      const comments = repliesRes?.ok ? repliesRes.data : [];
      renderComments(comments, parentComment);
    });

    card.style.cursor = 'pointer';
  });
}

async function reloadCurrentView() {
  if (commentStack.length === 0) {
    if (rootReloadFn) await rootReloadFn();
  } else {
    const current = commentStack[commentStack.length - 1];
    const repliesRes = await apiGet(`/replies/${current.id}/replies`);
    const comments = repliesRes?.ok ? repliesRes.data : [];
    renderComments(comments, current);
  }
}

function resetCommentStack() {
  commentStack = [];
}