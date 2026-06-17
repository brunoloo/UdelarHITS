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

async function loadReports() {
  const container = document.getElementById('reportsList');

  try {
    const res = await apiGet('/user-reports/pending');

    if (!res.ok || !res.data || res.data.length === 0) {
      container.innerHTML = '<div class="report-empty">No hay reportes pendientes</div>';
      return;
    }

    container.innerHTML = res.data.map(r => `
      <div class="report-item" id="report-${r.id}">
        <div class="report-item-header">
          <div class="report-item-user">
            <img class="report-item-avatar"
              src="${r.reportado_url_imagen || '/assets/default-user.jpg'}"
              alt="" onerror="this.src='/assets/default-user.jpg'" />
            <div>
              <span class="report-item-nickname">@${escapeHtml(r.reportado_nickname)}</span>
              <span class="report-item-name">${escapeHtml(r.reportado_nombre || '')}</span>
            </div>
          </div>
          <span class="report-item-date">${formatDate(r.fecha_creacion)}</span>
        </div>

        <div class="report-item-body">
          <div class="report-field">
            <label>Reportado por</label>
            <div class="report-field-content">@${escapeHtml(r.reportador_nickname)}</div>
          </div>
          <div class="report-field">
            <label>Motivo</label>
            <div class="report-field-content report-field-motivo">${escapeHtml(r.motivo)}</div>
          </div>
        </div>

        <div class="report-item-actions">
          <button class="report-btn report-btn--dismiss" data-report-id="${r.id}" data-decision="levantar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Levantar reporte
          </button>
          <button class="report-btn report-btn--deactivate" data-report-id="${r.id}" data-decision="inactivar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Inactivar cuenta
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<div class="report-empty">Error al cargar reportes</div>';
  }
}

async function resolveReport(reportId, decision) {
  const item = document.getElementById(`report-${reportId}`);
  const buttons = item.querySelectorAll('.report-btn');
  buttons.forEach(b => { b.disabled = true; });

  const label = decision === 'levantar' ? 'Levantando...' : 'Inactivando...';
  const activeBtn = decision === 'levantar' ? buttons[0] : buttons[1];
  const originalText = activeBtn.innerHTML;
  activeBtn.innerHTML = label;

  const result = await apiPatch(`/user-reports/${reportId}/resolve`, { decision });

  if (result.ok) {
    const msg = decision === 'levantar'
      ? 'Reporte levantado. No se tomó acción.'
      : 'Cuenta inactivada correctamente.';
    showToast(msg, 'success');

    item.style.transition = 'opacity 0.3s, transform 0.3s';
    item.style.opacity = '0';
    item.style.transform = 'translateX(20px)';
    setTimeout(() => {
      item.remove();
      const list = document.getElementById('reportsList');
      if (list.children.length === 0) {
        list.innerHTML = '<div class="report-empty">No hay reportes pendientes</div>';
      }
    }, 300);
  } else {
    showToast(result.message || 'Error al resolver', 'error');
    buttons.forEach(b => { b.disabled = false; });
    activeBtn.innerHTML = originalText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadReports();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.report-btn');
    if (!btn) return;
    const reportId = parseInt(btn.dataset.reportId);
    const decision = btn.dataset.decision;
    if (reportId && decision) resolveReport(reportId, decision);
  });
});