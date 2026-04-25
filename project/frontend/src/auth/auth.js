const EYE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
function showMessage(type, text) {
  const msg = document.getElementById('authMessage');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `auth-message ${type}`;
}
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Procesando...' : btn.dataset.label;
}
// Toggle mostrar/ocultar contraseña
document.querySelectorAll('.input-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
    btn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

// Register
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const btn = registerForm.querySelector('.auth-btn');
  btn.dataset.label = btn.textContent;
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (registerForm.password.value.length < 8) {
      showMessage('error', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(btn, true);
    const data = Object.fromEntries(new FormData(registerForm));
    const result = await apiPost('/auth/register', data);
    setLoading(btn, false);
    if (result.ok) {
      showMessage('success', result.message || '¡Cuenta creada! Redirigiendo...');
      registerForm.reset();
      setTimeout(() => window.location.href = '/src/auth/login.html', 2050);
    } else {
      showMessage('error', result.message || 'Error al registrarse.');
    }
  });
}
// Login
const params = new URLSearchParams(window.location.search);
if (params.get("msg") === "debes-iniciar-sesion") {
  showMessage("error", "Debés iniciar sesión para ver el perfil de otros usuarios");
}
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const btn = loginForm.querySelector('.auth-btn');
  btn.dataset.label = btn.textContent;
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));
    const body = { email: data.identifier, nickname: data.identifier, password: data.password };
    setLoading(btn, true);
    const result = await apiPost('/auth/login', body);
    setLoading(btn, false);
    if (result.ok) {
      window.location.href = '/';
    } else {
      showMessage('error', result.message || 'Credenciales incorrectas.');
    }
  });
}
// Logout (logout.html)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await apiPost('/auth/logout', {});
    window.location.href = '/';
  });
}