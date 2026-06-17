document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".settings-tab");
  const sections = document.querySelectorAll(".settings-section");

  function activate(tabId) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
    sections.forEach(s => s.classList.toggle("active", s.id === tabId));
  }

  // inicial
  const hash = window.location.hash?.replace("#", "");
  activate(hash || "apariencia");

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const id = tab.dataset.tab;
      history.replaceState(null, "", `#${id}`);
      activate(id);
    });
  });
});

// ── Selector de tema ───────────────────────────────────
const themeRadios = document.querySelectorAll('input[name="theme"]');

// Marcar el radio correcto al cargar
function syncThemeSelector() {
  const saved = localStorage.getItem('theme');
  const value = saved || 'system';  
  
  themeRadios.forEach(radio => {
    radio.checked = (radio.value === value);
  });
}

syncThemeSelector();

// Escuchar cambios
themeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'system') {
      window.clearTheme();
    } else {
      window.setTheme(radio.value);
    }
  });
});

// ── Modal cambio de contraseña ─────────────────────────
(function initChangePassword() {
  const btn = document.getElementById('btn-change-password');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (document.getElementById('modal-change-password')) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.id = 'modal-change-password';

    // Estas dos líneas van ANTES del backdrop.innerHTML
    const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const EYE_OFF_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

    backdrop.innerHTML = `
      <div class="modal" style="width: 420px;">
        <div class="modal-head">
          <button class="modal-close" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <h3>Cambiar contraseña</h3>
          <button class="save-btn" id="cp-submit">Guardar</button>
        </div>
        <div class="edit-body">
          <div class="edit-field">
              <div class="edit-field-label"><span>Contraseña actual</span></div>
              <div class="input-wrapper">
              <input type="password" id="cp-current" autocomplete="current-password" />
              <button type="button" class="input-toggle" aria-label="Mostrar contraseña">
              ${EYE_ICON}
              </button>
              </div>
              </div>
              <a href="/src-central/cuenta/forgot-password.html" target="_blank" class="cp-forgot-link">¿Olvidaste tu contraseña?</a>
            <div class="edit-field">
              <div class="edit-field-label"><span>Nueva contraseña</span></div>
              <div class="input-wrapper">
                <input type="password" id="cp-new" autocomplete="new-password" />
                <button type="button" class="input-toggle" aria-label="Mostrar contraseña">
                  ${EYE_ICON}
                </button>
              </div>
            </div>
            <div class="edit-field">
              <div class="edit-field-label"><span>Confirmar nueva contraseña</span></div>
              <div class="input-wrapper">
                <input type="password" id="cp-confirm" autocomplete="new-password" />
                <button type="button" class="input-toggle" aria-label="Mostrar contraseña">
                  ${EYE_ICON}
                </button>
              </div>
            </div>
          <p class="cp-error" id="cp-error"></p>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.querySelectorAll('.input-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
        btn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    });

    const close = () => backdrop.remove();
    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // Submit
    backdrop.querySelector('#cp-submit').addEventListener('click', async () => {
      const errorEl = backdrop.querySelector('#cp-error');
      const currentPassword = backdrop.querySelector('#cp-current').value;
      const newPassword = backdrop.querySelector('#cp-new').value;
      const confirmPassword = backdrop.querySelector('#cp-confirm').value;

      errorEl.textContent = '';

      if (!currentPassword || !newPassword || !confirmPassword) {
        errorEl.textContent = 'Completá todos los campos.';
        return;
      }

      if (newPassword.length < 8) {
        errorEl.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.';
        return;
      }

      if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Las contraseñas nuevas no coinciden.';
        return;
      }

      if (currentPassword === newPassword) {
        errorEl.textContent = 'La nueva contraseña debe ser diferente a la actual.';
        return;
      }

      const submitBtn = backdrop.querySelector('#cp-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';

      try {
        const res = await apiPut('/users/change-password', { currentPassword, newPassword });

        if (res.ok) {
          close();
          window.showToast?.('Contraseña actualizada correctamente', 'success');
        } else {
          errorEl.textContent = res.message || 'Error al cambiar la contraseña.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar';
        }
      } catch {
        errorEl.textContent = 'Error de conexión.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
      }
    });
  });
})();

// ── Toggle de privacidad ───────────────────────────
(async function initPrivacyToggle() {
  const toggle = document.getElementById('privacyToggle');
  if (!toggle) return;

  // Cargar estado actual
  try {
    const res = await apiGet('/users/me');
    if (res?.ok) {
      toggle.checked = res.data.user.privado;
    }
  } catch {}

  toggle.addEventListener('change', async () => {
    try {
      const res = await apiPatch('/users/me/privacy', {});
      if (res?.ok) {
        const isPrivate = res.data.privado;
        toggle.checked = isPrivate;
        window.showToast?.(
          isPrivate ? 'Tu cuenta ahora es privada' : 'Tu cuenta ahora es pública',
          'success'
        );
      } else {
        toggle.checked = !toggle.checked;
        window.showToast?.('Error al cambiar la privacidad', 'error');
      }
    } catch {
      toggle.checked = !toggle.checked;
      window.showToast?.('Error de conexión', 'error');
    }
  });
})();