const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function showToast(msg, type) {
  const toast = document.getElementById('miToast');
  toast.textContent = msg;
  toast.className = 'mi-toast mi-toast--' + (type || 'info') + ' mi-toast--visible';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('mi-toast--visible'); }, 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const tokenInvalid = document.getElementById('tokenInvalid');
  const resetForm = document.getElementById('resetForm');
  const resetSuccess = document.getElementById('resetSuccess');

  // Si no hay token en la URL, mostrar estado inválido
  if (!token) {
    resetForm.style.display = 'none';
    tokenInvalid.style.display = 'block';
    return;
  }

  // Validar que el token existe y no expiró
  try {
    const check = await apiPost('/auth/verify-reset-token', { token });
    if (!check.ok) {
      resetForm.style.display = 'none';
      tokenInvalid.style.display = 'block';
      return;
    }
  } catch {
    resetForm.style.display = 'none';
    tokenInvalid.style.display = 'block';
    return;
  }

  // Toggle mostrar/ocultar contraseña
  document.querySelectorAll('.ca-input-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
      btn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  // Submit
  const errorEl = document.getElementById('resetError');
  const btn = document.getElementById('btnResetPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmInput = document.getElementById('confirmPassword');

  btn.addEventListener('click', async () => {
    const newPassword = newPasswordInput.value;
    const confirm = confirmInput.value;
    errorEl.textContent = '';

    if (!newPassword || !confirm) {
      errorEl.textContent = 'Completá ambos campos.';
      return;
    }

    if (newPassword.length < 8) {
      errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    if (newPassword !== confirm) {
      errorEl.textContent = 'Las contraseñas no coinciden.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const res = await apiPost('/auth/reset-password', { token, newPassword });

      if (res.ok) {
        resetForm.style.display = 'none';
        resetSuccess.style.display = 'block';
      } else {
        if (res.message?.includes('expirado') || res.message?.includes('inválido')) {
          resetForm.style.display = 'none';
          tokenInvalid.style.display = 'block';
        } else {
          errorEl.textContent = res.message || 'Error al cambiar la contraseña.';
          btn.disabled = false;
          btn.textContent = 'Guardar nueva contraseña';
        }
      }
    } catch {
      errorEl.textContent = 'Error de conexión. Intentá de nuevo.';
      btn.disabled = false;
      btn.textContent = 'Guardar nueva contraseña';
    }
  });

  // Enter en inputs
  [newPasswordInput, confirmInput].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btn.click();
      }
    });
  });
});