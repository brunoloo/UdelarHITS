function showToast(msg, type) {
  const toast = document.getElementById('miToast');
  toast.textContent = msg;
  toast.className = 'mi-toast mi-toast--' + (type || 'info') + ' mi-toast--visible';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('mi-toast--visible'); }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('requestForm');
  const sent = document.getElementById('requestSent');
  const emailInput = document.getElementById('resetEmail');
  const errorEl = document.getElementById('requestError');
  const btn = document.getElementById('btnSendReset');

  btn.addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    errorEl.textContent = '';

    if (!email) {
      errorEl.textContent = 'Ingresá tu correo electrónico.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorEl.textContent = 'El formato del correo no es válido.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await apiPost('/auth/forgot-password', { email });

      if (!res.ok) {
        errorEl.textContent = res.message || 'Error al procesar la solicitud. Intentá de nuevo.';
        btn.disabled = false;
        btn.textContent = 'Enviar enlace de recuperación';
        return;
      }

      form.style.display = 'none';
      sent.style.display = 'block';
    } catch {
      errorEl.textContent = 'Error de conexión. Intentá de nuevo.';
      btn.disabled = false;
      btn.textContent = 'Enviar enlace de recuperación';
    }
  });

  // Enter en el input
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btn.click();
    }
  });
});