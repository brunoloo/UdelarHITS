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
            src="${API_BASE}/users/${user.id}/avatar"
            alt="${user.nickname}"
            onerror="this.style.display='none'" />
          ${user.nickname}
        </button>
        <div class="user-menu" id="userMenu" style="display:none;">
          <a href="/src/user/profile.html" class="user-menu-item">Ver perfil</a>
          <button id="logoutBtn" class="user-menu-item user-menu-item--danger">Cerrar sesión</button>
        </div>
      </div>
    `;

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