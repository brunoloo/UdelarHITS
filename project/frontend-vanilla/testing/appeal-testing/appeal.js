// Minimal showToast si no existe (testing pages no cargan header.js)
if (typeof showToast === 'undefined') {
  window.showToast = function(msg, type) {
    let toast = document.getElementById('adminToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminToast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;opacity:0;transition:all .2s;z-index:200;font-family:DM Sans,sans-serif;';
      document.body.appendChild(toast);
    }
    const colors = { success: '#1a7f37', error: '#d93025', info: '#333' };
    toast.textContent = msg;
    toast.style.background = colors[type] || colors.info;
    toast.style.color = '#fff';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 4000);
  };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadAppeals() {
  await loadSection('tema', 'appealsTema');
  await loadSection('comentario', 'appealsComentario');
  await loadSection('categoria', 'appealsCategoria');
}

async function loadSection(tipo, containerId) {
  const container = document.getElementById(containerId);

  try {
    const res = await apiGet(`/appeals/pending?tipo=${tipo}`);

    if (!res.ok || !res.data || res.data.length === 0) {
      container.innerHTML = '<div class="appeal-empty">No hay apelaciones pendientes</div>';
      return;
    }

    container.innerHTML = res.data.map(a => `
      <div class="appeal-item" id="appeal-${a.id}">
        <div class="appeal-item-header">
          <div>
            <span class="appeal-item-title">${escapeHtml(a.titulo)}</span>
            <span class="appeal-item-author">por ${escapeHtml(a.autor_nickname)}</span>
          </div>
          <span class="appeal-item-date">${formatDate(a.fecha_solicitud)}</span>
        </div>

        <div class="appeal-item-body">
          ${a.tema_titulo ? `
          <div class="appeal-field">
            <label>Título del tema</label>
            <div class="appeal-field-content" style="font-weight:600;">${escapeHtml(a.tema_titulo)}</div>
          </div>` : ''}
          ${a.categoria_titulo ? `
          <div class="appeal-field">
            <label>Categoría</label>
            <div class="appeal-field-content">${escapeHtml(a.categoria_titulo)}</div>
          </div>` : ''}
          <div class="appeal-field">
            <label>Contenido reportado</label>
            <div class="appeal-field-content">${escapeHtml(a.contenido_cuerpo)}</div>
          </div>
          <div class="appeal-field">
            <label>Justificación del autor</label>
            <div class="appeal-field-content appeal-field-justificacion">${escapeHtml(a.justificacion)}</div>
          </div>
        </div>

        <div class="appeal-item-actions">
          <button class="appeal-btn appeal-btn--accept" data-appeal-id="${a.id}" data-decision="aceptar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Aceptar — restaurar contenido
          </button>
          <button class="appeal-btn appeal-btn--reject" data-appeal-id="${a.id}" data-decision="rechazar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Rechazar — eliminar definitivamente
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<div class="appeal-empty">Error al cargar apelaciones</div>';
  }
}

async function resolveAppeal(appealId, decision) {
  const item = document.getElementById(`appeal-${appealId}`);
  const buttons = item.querySelectorAll('.appeal-btn');
  buttons.forEach(b => { b.disabled = true; });

  const label = decision === 'aceptar' ? 'Aceptando...' : 'Rechazando...';
  const activeBtn = decision === 'aceptar' ? buttons[0] : buttons[1];
  const originalText = activeBtn.innerHTML;
  activeBtn.innerHTML = label;

  const result = await apiPatch(`/appeals/${appealId}/resolve`, { decision });

  if (result.ok) {
    const msg = decision === 'aceptar'
      ? 'Apelación aceptada. Contenido restaurado.'
      : 'Apelación rechazada. Contenido eliminado.';
    showToast(msg, 'success');

    item.style.transition = 'opacity 0.3s, transform 0.3s';
    item.style.opacity = '0';
    item.style.transform = 'translateX(20px)';
    setTimeout(() => {
      item.remove();
      // Si la sección quedó vacía, mostrar mensaje
      document.querySelectorAll('.appeal-list').forEach(list => {
        if (list.children.length === 0) {
          list.innerHTML = '<div class="appeal-empty">No hay apelaciones pendientes</div>';
        }
      });
    }, 300);
  } else {
    showToast(result.message || 'Error al resolver', 'error');
    buttons.forEach(b => { b.disabled = false; });
    activeBtn.innerHTML = originalText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAppeals();

  // Event delegation para botones de resolución (CSP prohíbe onclick inline)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.appeal-btn');
    if (!btn) return;
    const appealId = parseInt(btn.dataset.appealId);
    const decision = btn.dataset.decision;
    if (appealId && decision) resolveAppeal(appealId, decision);
  });
});