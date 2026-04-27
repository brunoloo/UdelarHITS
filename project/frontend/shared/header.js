const API_BASE = "http://localhost:5001/api";

document.addEventListener('DOMContentLoaded', async () => {
  const isTesting = window.location.pathname.includes('/testing');
  const homeUrl = isTesting ? '/testing.html' : '/';

  const header = document.createElement('header');
  header.innerHTML = `
    <a href="${homeUrl}" class="logo">Udelar<span>HITS</span></a>
    <div class="search-bar">
      <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input type="text" id="searchInput" placeholder="Busca lo que quieras..." autocomplete="off" />
    </div>
    <div class="header-actions" id="headerActions"></div>
  `;
  document.body.prepend(header);

  let res = null;
  try { res = await apiGet("/users/me"); } catch (e) {}

  const actions = document.getElementById("headerActions");

  if (res?.ok) {
    const user = res.data.user;
    actions.innerHTML = `
      <div class="user-menu-wrapper">
        <button class="user-chip" id="userMenuBtn">
          <img class="user-avatar"
            src="${API_BASE}/users/${encodeURIComponent(user.id)}/avatar"
            alt="${escapeHtml(user.nickname)}"
            onerror="this.style.display='none'" />
          ${escapeHtml(user.nickname)}
        </button>
        <div class="user-menu" id="userMenu" style="display:none;">
          <a href="/src/user/profile.html" class="user-menu-item">Ver perfil</a>
          <button id="logoutBtn" class="user-menu-item user-menu-item--danger">Cerrar sesión</button>
        </div>
      </div>
    `;
    actions.querySelector('img.user-avatar')?.addEventListener('error', (ev) => {
      ev.currentTarget.style.display = 'none';
    });

    document.getElementById("userMenuBtn").addEventListener("click", () => {
      const menu = document.getElementById("userMenu");
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const result = await apiPost("/auth/logout", {});
      if (result.ok) {
        window.location.href = "/";
      } else {
        alert(result.message || "Error al cerrar sesión");
      }
     });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".user-menu-wrapper")) {
        const menu = document.getElementById("userMenu");
        if (menu) menu.style.display = "none";
      }
    });

  } else {
    actions.innerHTML = `
      <a class="btn-ghost" href="/src/auth/login.html">Iniciar sesión</a>
      <a class="btn-primary" href="/src/auth/register.html">Registrarse</a>
    `;
  }
});

const toast = document.createElement("div");
toast.id = "globalToast";
toast.style.cssText = `
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  display: none;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;
document.body.appendChild(toast);

window.showToast = (msg, type = "error") => {
  toast.textContent = msg;
  toast.style.background = type === "success" ? "#f0fdf4" : "#fef2f2";
  toast.style.border = `1px solid ${type === "success" ? "#bbf7d0" : "#fecaca"}`;
  toast.style.color = type === "success" ? "#166534" : "#dc2626";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 4000);
};