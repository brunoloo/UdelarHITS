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

const CHUNK_CHARS = 500;
const CHUNK_LINES = 8;

let commentStack = [];
let currentMeRes = null;
let rootReloadFn = null; // cada página setea esto

function setCommentConfig({ meRes, reloadFn }) {
  currentMeRes = meRes;
  rootReloadFn = reloadFn;
}

function truncateText(texto) {
  const lines = texto.split('\n');
  const needsTruncate = texto.length > CHUNK_CHARS || lines.length > CHUNK_LINES;

  if (!needsTruncate) return { visible: texto, truncated: false };

  const byChars = texto.slice(0, CHUNK_CHARS);
  const byLines = lines.slice(0, CHUNK_LINES).join('\n');
  const visible = byChars.length < byLines.length ? byChars : byLines;

  return { visible: visible + '...', truncated: true };
}

// ──────────────────────────────────────────────
// Render de un comentario (template reutilizable)
// ──────────────────────────────────────────────
// role: 'ancestor' | 'reply'
//   - ancestor: parte del camino, NO clickeable para profundizar, "X respuestas" sin acción.
//   - reply: respuesta directa, clickeable para profundizar.
// index: posición dentro de su grupo (para IDs únicos del "Leer más").
// indexPrefix: 'a' para ancestros, 'r' para replies (evita colisión de IDs).
function renderCommentCard(c, role, index, indexPrefix) {
  const texto = c.cuerpo || '';
  const { visible, truncated } = truncateText(texto);
  const replyCount = Number(c.contador_respuestas) || 0;
  const textId = `comment-text-${indexPrefix}-${index}`;

  const cardClasses = ['comment-card'];
  if (role === 'ancestor') cardClasses.push('comment-card--ancestor');
  if (role === 'reply') cardClasses.push('comment-card--clickable');

  // Data attrs solo en replies (las únicas que profundizan)
  const dataAttrs = role === 'reply'
    ? `data-comment-id="${c.id}" data-author="${escapeHtml(c.autor_nickname)}" data-body="${escapeHtml(c.cuerpo)}" data-date="${c.fecha_creacion}" data-autor-id="${c.autor_id}" data-reply-count="${replyCount}"`
    : `data-comment-id="${c.id}"`;

  // Botón de respuestas: en ancestros es info sin acción; en replies es clickeable y profundiza
  // (en replies el click sobre la card ya profundiza, así que el botón solo refleja la info).
  const repliesBtnHtml = replyCount > 0
    ? `<span class="comment-action-info">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
         ${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}
       </span>`
    : '';

  return `
    <div class="${cardClasses.join(' ')}" ${dataAttrs}>
      <div class="comment-gutter">
        <img class="comment-avatar"
             src="${API_BASE}/users/${encodeURIComponent(c.autor_id)}/avatar"
             alt="${escapeHtml(c.autor_nickname)}" />
      </div>
      <div class="comment-body">
        <div class="comment-head">
          <a href="/src/user/profile.html?nickname=${encodeURIComponent(c.autor_nickname)}">${escapeHtml(c.autor_nickname)}</a>
          <span>·</span>
          <span>${escapeHtml(timeAgo(c.fecha_creacion))}</span>
        </div>
        <div class="comment-text" id="${textId}" data-full="${escapeHtml(texto)}">${escapeHtml(visible)}</div>
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
      const currentText = el.textContent.replace(/\.\.\.$/, '');

      if (currentText === fullText) {
        const { visible } = truncateText(fullText);
        el.textContent = visible;
        btn.textContent = 'Leer más';
        return;
      }

      const currentLines = currentText.split('\n').length;
      const allLines = fullText.split('\n');
      const nextByLines = allLines.slice(0, currentLines + CHUNK_LINES).join('\n');
      const nextByChars = fullText.slice(0, currentText.length + CHUNK_CHARS);
      const next = nextByChars.length < nextByLines.length ? nextByChars : nextByLines;

      if (next.length >= fullText.length) {
        el.textContent = fullText;
        btn.textContent = 'Leer menos';
      } else {
        el.textContent = next + '...';
      }
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

      if (!currentMeRes?.ok) {
        window.location.href = '/src/auth/login.html?msg=crear-comentario';
        return;
      }

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
            <span class="edit-field-counter inline-reply-counter">0 / 2000</span>
          </div>
          <textarea class="inline-reply-input" maxlength="2000" rows="3" placeholder="Escribí tu respuesta"></textarea>
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
        counter.textContent = input.value.length + ' / 2000';
        submitBtn.disabled = input.value.trim().length < 1;
      });

      cancelBtn.addEventListener('click', () => panel.remove());

      submitBtn.addEventListener('click', async () => {
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
        contador_respuestas: Number(card.dataset.replyCount) || 0
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