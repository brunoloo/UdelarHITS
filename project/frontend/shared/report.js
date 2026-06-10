// ── Modal de Reporte ──
// Inyecta el modal en el DOM y expone window.openReportModal(contenidoId).
// Usado por comments.js (reporte de comentario) y topic.js (reporte de tema).
// Reusa la estructura de modal.css (.modal-backdrop, .modal, .modal-head, etc.)

const REPORT_MOTIVOS = [
  { value: 'spam', label: 'Spam', desc: 'Contenido comercial, repetitivo o irrelevante' },
  { value: 'incitacionOdio', label: 'Incitación al odio', desc: 'Discurso que ataca a un grupo por identidad' },
  { value: 'acoso', label: 'Acoso', desc: 'Hostigamiento dirigido a una persona' },
  { value: 'contenidoInapropiado', label: 'Contenido inapropiado', desc: 'Sexual, violento o fuera de contexto' },
  { value: 'informacionEnganosa', label: 'Información engañosa', desc: 'Datos falsos presentados como verdaderos' },
  { value: 'suplantacion', label: 'Suplantación', desc: 'Hacerse pasar por otra persona o entidad' }
];

let reportModal = null;
let currentReportId = null;

function injectReportModal() {
  if (document.getElementById('reportModal')) return;

  const optionsHtml = REPORT_MOTIVOS.map(m => `
    <label class="report-option">
      <div class="report-option-text">
        <span class="report-option-label">${m.label}</span>
        <span class="report-option-desc">${m.desc}</span>
      </div>
      <input type="radio" name="reportMotivo" value="${m.value}" />
    </label>
  `).join('');

  const html = `
    <div class="modal-backdrop" id="reportModal">
      <div class="modal report-modal">
        <div class="modal-head">
          <button class="modal-close" id="closeReportModal" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h3>¿Qué estás reportando?</h3>
        </div>
        <div class="edit-body">
          <p class="report-subtitle">Elegí la categoría que mejor describe el problema.</p>
          <div class="report-options">
            ${optionsHtml}
          </div>
        </div>
        <div class="report-footer">
          <button class="save-btn report-submit-btn" id="submitReport" disabled>Enviar reporte</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  reportModal = document.getElementById('reportModal');

  // Cerrar con X
  document.getElementById('closeReportModal').addEventListener('click', closeReportModal);

  // Cerrar con click en backdrop
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) closeReportModal();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reportModal.classList.contains('open')) {
      closeReportModal();
    }
  });

  // Habilitar botón al seleccionar un motivo
  reportModal.querySelectorAll('input[name="reportMotivo"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('submitReport').disabled = false;
    });
  });

  // Enviar reporte
  document.getElementById('submitReport').addEventListener('click', handleSubmitReport);
}

function closeReportModal() {
  if (!reportModal) return;
  reportModal.classList.remove('open');
  document.body.style.overflow = '';
  currentReportId = null;
  // Reset radios y botón
  reportModal.querySelectorAll('input[name="reportMotivo"]').forEach(r => { r.checked = false; });
  const btn = document.getElementById('submitReport');
  btn.disabled = true;
  btn.textContent = 'Enviar reporte';
}

async function handleSubmitReport() {
  const btn = document.getElementById('submitReport');
  const selected = reportModal.querySelector('input[name="reportMotivo"]:checked');
  if (!selected || !currentReportId) return;

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const result = await apiPost('/reports/create', {
    contenido_id: currentReportId,
    motivo: selected.value
  });

  closeReportModal();

  if (result.ok) {
    showToast(result.message || 'Reporte registrado', 'success');
  } else {
    showToast(result.message || 'Error al reportar', 'error');
  }
}

window.openReportModal = function(contenidoId) {
  injectReportModal();
  currentReportId = contenidoId;
  reportModal.classList.add('open');
  document.body.style.overflow = 'hidden';
};