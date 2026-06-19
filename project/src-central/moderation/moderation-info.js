function showToast(msg, type) {
  const toast = document.getElementById('miToast');
  toast.textContent = msg;
  toast.className = 'mi-toast mi-toast--' + (type || 'info') + ' mi-toast--visible';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('mi-toast--visible'); }, 4000);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-UY', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  return text.slice(0, max) + '...';
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  const tipo = params.get('tipo');
  if (tipo === 'tema' || tipo === 'comentario' || tipo === 'categoria') {
    const label = tipo === 'categoria' ? 'categoría' : tipo;
    document.getElementById('modInfoLead').textContent =
      'Tu ' + label + ' fue ocultada porque múltiples usuarios de la comunidad la reportaron. A continuación te explicamos qué significa esto y cuáles son tus opciones.';
  }

  document.getElementById('btnAccept').addEventListener('click', () => {
    window.close();
    setTimeout(() => { window.location.href = '/'; }, 100);
  });

  const selectModal = document.getElementById('selectModal');
  const appealModal = document.getElementById('appealModal');
  const moderatedList = document.getElementById('moderatedList');
  const appealInput = document.getElementById('appealInput');
  const appealCounter = document.getElementById('appealCounter');
  const submitBtn = document.getElementById('submitAppeal');
  const preview = document.getElementById('selectedContentPreview');

  let selectedContenidoId = null;
  let selectedCategoriaId = null;

  function closeSelect() {
    selectModal.classList.remove('open');
    document.body.style.overflow = '';
  }
  function closeAppeal() {
    appealModal.classList.remove('open');
    document.body.style.overflow = '';
    selectedContenidoId = null;
    selectedCategoriaId = null;
  }

  document.getElementById('closeSelectModal').addEventListener('click', closeSelect);
  selectModal.addEventListener('click', (e) => { if (e.target === selectModal) closeSelect(); });
  document.getElementById('closeAppealModal').addEventListener('click', closeAppeal);
  appealModal.addEventListener('click', (e) => { if (e.target === appealModal) closeAppeal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (appealModal.classList.contains('open')) closeAppeal();
      else if (selectModal.classList.contains('open')) closeSelect();
    }
  });

  // ── Paso 1: "Apelar mi contenido" → panel de administración en construcción ──
  document.getElementById('btnAppeal').addEventListener('click', async () => {
    showToast('El panel de administración está en construcción', 'info');
    return;

    // -- código deshabilitado temporalmente --
    selectModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    moderatedList.innerHTML = '<div class="moderated-loading">Cargando...</div>';

    const res = await apiGet('/appeals/my-moderated-content');

    if (!res.ok || !res.data || res.data.length === 0) {
      moderatedList.innerHTML = '<div class="moderated-empty">No tenés contenido moderado pendiente de apelación</div>';
      return;
    }

    moderatedList.innerHTML = res.data.map(item => {
      const isPending = item.tiene_apelacion_pendiente;
      const badgeLabels = { tema: 'Tema', comentario: 'Comentario', categoria: 'Categoría' };
      const badge = badgeLabels[item.tipo] || item.tipo;
      const bodyPreview = truncate(item.cuerpo, 120);
      const title = item.contenido_titulo
        ? escapeHtml(item.contenido_titulo.replace(/_deleted_\d+$/, ''))
        : '';
      const disabledClass = isPending ? 'moderated-item--disabled' : '';
      const pendingLabel = isPending ? '<span class="moderated-pending">Apelación pendiente</span>' : '';
      const cId = item.contenido_id || '';
      const catId = item.categoria_id || '';

      return `
        <div class="moderated-item ${disabledClass}" data-contenido-id="${cId}" data-categoria-id="${catId}" data-cuerpo="${escapeHtml(item.cuerpo)}" data-tipo="${item.tipo}">
          <div class="moderated-item-top">
            <span class="moderated-badge moderated-badge--${item.tipo}">${badge}</span>
            <span class="moderated-date">${formatDate(item.fecha_inactivacion)}</span>
          </div>
          ${title ? '<div class="moderated-title">' + title + '</div>' : ''}
          <div class="moderated-body">${escapeHtml(bodyPreview)}</div>
          ${pendingLabel}
        </div>
      `;
    }).join('');

    moderatedList.querySelectorAll('.moderated-item:not(.moderated-item--disabled)').forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        selectedContenidoId = item.dataset.contenidoId || null;
        selectedCategoriaId = item.dataset.categoriaId || null;
        const cuerpo = item.dataset.cuerpo;
        const itemTipo = item.dataset.tipo;
        const badgeLabels = { tema: 'Tema', comentario: 'Comentario', categoria: 'Categoría' };

        preview.innerHTML = `
          <div class="selected-preview-box">
            <span class="moderated-badge moderated-badge--${itemTipo}">${badgeLabels[itemTipo]}</span>
            <p>${escapeHtml(truncate(cuerpo, 200))}</p>
          </div>
        `;

        closeSelect();
        appealModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        appealInput.value = '';
        appealCounter.textContent = '0 / 2000';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviar apelación';
        setTimeout(() => appealInput.focus(), 50);
      });
    });
  });

  // ── Paso 2: Justificación ──
  appealInput.addEventListener('input', () => {
    appealCounter.textContent = appealInput.value.length + ' / 2000';
    submitBtn.disabled = appealInput.value.trim().length < 1;
  });

  submitBtn.addEventListener('click', async () => {
    if (submitBtn.disabled || (!selectedContenidoId && !selectedCategoriaId)) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    const body = { justificacion: appealInput.value.trim() };
    if (selectedCategoriaId) {
      body.categoria_id = selectedCategoriaId;
    } else {
      body.contenido_id = selectedContenidoId;
    }

    const result = await apiPost('/appeals/create', body);

    if (result.ok) {
      closeAppeal();
      showToast('Apelación enviada. Un administrador la revisará.', 'success');
    } else {
      closeAppeal();
      showToast(result.message || 'Error al enviar la apelación', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar apelación';
    }
  });
});