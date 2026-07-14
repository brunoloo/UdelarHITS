function showToast(msg, type) {
  const toast = document.getElementById('miToast');
  toast.textContent = msg;
  toast.className = 'mi-toast mi-toast--' + (type || 'info') + ' mi-toast--visible';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('mi-toast--visible'); }, 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const deleteInfo = document.getElementById('deleteInfo');
  const deleteSuccess = document.getElementById('deleteSuccess');
  const passwordInput = document.getElementById('deletePassword');
  const nicknameInput = document.getElementById('deleteNickname');
  const confirmPassword = document.getElementById('confirmPassword');
  const confirmNickname = document.getElementById('confirmNickname');
  const confirmNicknameValue = document.getElementById('confirmNicknameValue');
  const errorEl = document.getElementById('deleteError');
  const btn = document.getElementById('btnDeleteAccount');

  // Cuentas sin contraseña (Google) confirman re-tipeando el nickname, no la
  // contraseña. Averiguamos cuál mostrar consultando la sesión actual.
  let usaNickname = false;
  try {
    const me = await apiGet('/users/me');
    const user = me?.data?.user;
    if (user && user.tiene_password === false) {
      usaNickname = true;
      confirmNicknameValue.textContent = user.nickname;
      confirmPassword.style.display = 'none';
      confirmNickname.style.display = 'block';
    }
  } catch {
    // Si falla, se queda con el flujo por contraseña (el backend igual valida).
  }

  btn.addEventListener('click', async () => {
    errorEl.textContent = '';

    let payload;
    if (usaNickname) {
      const nickname = nicknameInput.value.trim();
      if (!nickname) {
        errorEl.textContent = 'Escribí tu nickname para confirmar.';
        return;
      }
      payload = { nickname };
    } else {
      const password = passwordInput.value;
      if (!password) {
        errorEl.textContent = 'Ingresá tu contraseña para confirmar.';
        return;
      }
      payload = { password };
    }

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
      const res = await apiPost('/users/me/deactivate', payload);

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

  // Enter en cualquiera de los inputs dispara la confirmación.
  [passwordInput, nicknameInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btn.click();
      }
    });
  });
});