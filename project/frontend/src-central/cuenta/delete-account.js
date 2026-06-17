function showToast(msg, type) {
  const toast = document.getElementById('miToast');
  toast.textContent = msg;
  toast.className = 'mi-toast mi-toast--' + (type || 'info') + ' mi-toast--visible';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('mi-toast--visible'); }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  const deleteInfo = document.getElementById('deleteInfo');
  const deleteSuccess = document.getElementById('deleteSuccess');
  const passwordInput = document.getElementById('deletePassword');
  const errorEl = document.getElementById('deleteError');
  const btn = document.getElementById('btnDeleteAccount');

  btn.addEventListener('click', async () => {
    const password = passwordInput.value;
    errorEl.textContent = '';

    if (!password) {
      errorEl.textContent = 'Ingresá tu contraseña para confirmar.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
      const res = await apiPost('/users/me/deactivate', { password });

      if (res.ok) {
        deleteInfo.style.display = 'none';
        deleteSuccess.style.display = 'block';
      } else {
        errorEl.textContent = res.message || 'Error al eliminar la cuenta.';
        btn.disabled = false;
        btn.textContent = 'Eliminar mi cuenta';
      }
    } catch {
      errorEl.textContent = 'Error de conexión. Intentá de nuevo.';
      btn.disabled = false;
      btn.textContent = 'Eliminar mi cuenta';
    }
  });

  // Enter en el input
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btn.click();
    }
  });
});