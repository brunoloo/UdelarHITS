let followers = [];
let following = [];
let categories = [];

function updateFollowBtn(btn, siguiendo) {
  if (siguiendo) {
    btn.textContent = "Siguiendo";
    btn.className = "btn-follow btn-follow--siguiendo";
  } else {
    btn.textContent = "Seguir";
    btn.className = "btn-follow";
  }
}

function updateSeguidoresUI() {
  const n = followers.length;
  document.getElementById("profileSeguidores").textContent = n;
  document.getElementById("labelSeguidores").textContent = n === 1 ? "Seguidor" : "Seguidores";
}

async function loadTabs(userId, categories) {
  // Categorías
  const catGrid = document.getElementById("panelCategorias");
  document.getElementById("countCategorias").textContent = categories?.length ?? 0;

  if (!categories || categories.length === 0) {
    catGrid.innerHTML = `<div class="empty-panel" style="grid-column:1/-1">Sin categorías aún</div>`;
  } else {
    catGrid.innerHTML = categories.map(c => {
      const n = parseInt(c.contador_temas) || 0;
      return `
      <a class="cat" href="/src/category/category.html?id=${encodeURIComponent(c.id)}">
        <div class="cat-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/></svg>
        </div>
        <div class="cat-text">
          <div class="t">${escapeHtml(c.titulo)}</div>
          <div class="s">${n} ${n === 1 ? 'tema' : 'temas'}</div>
        </div>
      </a>
    `;
    }).join('');
  }

  // Temas
  const topicsRes = await apiGet(`/topics/user/${userId}`);
  const temasList = document.getElementById("panelTemas");
  const temas = topicsRes.ok ? topicsRes.data : [];
  document.getElementById("countTemas").textContent = temas.length;

  if (temas.length === 0) {
    temasList.innerHTML = `<div class="empty-panel">Sin temas aún</div>`;
  } else {
    temasList.innerHTML = temas.map(t => `
      <article class="item">
        <div class="item-head">
          <span>en</span>
          <a href="/src/category/category.html?id=${encodeURIComponent(t.categoria_id)}">${escapeHtml(t.categoria_titulo)}</a>
        </div>
        <h3 class="item-title"><a href="/src/topic/topic.html?id=${encodeURIComponent(t.id)}" style="text-decoration:none;color:inherit;">${escapeHtml(t.titulo)}</a></h3>
        <p class="item-body">${escapeHtml(t.cuerpo || '')}</p>
      </article>
    `).join('');
  }

  // Comentarios
  const repliesRes = await apiGet(`/replies/user/${userId}`);
  const comentariosList = document.getElementById("panelComentarios");
  const comentarios = repliesRes.ok ? repliesRes.data : [];
  document.getElementById("countComentarios").textContent = comentarios.length;

  if (comentarios.length === 0) {
    comentariosList.innerHTML = `<div class="empty-panel">Sin comentarios aún</div>`;
  } else {
    comentariosList.innerHTML = comentarios.map(r => {
      const href = r.tipo === 'tema'
        ? `/src/topic/topic.html?id=${encodeURIComponent(r.destino_id)}`
        : `/src/category/category.html?id=${encodeURIComponent(r.destino_id)}`;
      return `
      <article class="item">
        <div class="item-head">
          <span>en</span>
          <a href="${href}">${escapeHtml(r.destino_titulo)}</a>
        </div>
        <p class="item-body">${escapeHtml(r.cuerpo)}</p>
      </article>
    `;
    }).join('');
  }
}

function initEditModal(user) {
  const modal = document.getElementById("editModal");
  const editBtn = document.querySelector(".profile-edit-btn");
  const closeBtn = document.getElementById("closeModal");
  const saveBtn = document.getElementById("saveBtn");
  const fName = document.getElementById("fName");
  const fBio = document.getElementById("fBio");
  const nameCounter = document.getElementById("nameCounter");
  const bioCounter = document.getElementById("bioCounter");
  const avatarPreview = document.getElementById("editAvatarPreview");
  const avatarFileInput = document.getElementById("avatarFileInput");
  const changeAvatarBtn = document.getElementById("changeAvatarBtn");

  let pendingAvatarFile = null;

  function openModal() {
    fName.value = document.getElementById("profileNombre").textContent;
    fBio.value = document.getElementById("profileBio").textContent;
    avatarPreview.src = document.getElementById("profileAvatar").src;
    pendingAvatarFile = null;
    syncCounters();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function syncCounters() {
    nameCounter.textContent = `${fName.value.length} / 50`;
    bioCounter.textContent = `${fBio.value.length} / 160`;
    nameCounter.classList.toggle("limit", fName.value.length >= 50);
    bioCounter.classList.toggle("limit", fBio.value.length >= 160);
  }

  editBtn?.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  fName.addEventListener("input", syncCounters);
  fBio.addEventListener("input", syncCounters);

  changeAvatarBtn.addEventListener("click", () => avatarFileInput.click());

  avatarFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingAvatarFile = file;
    avatarPreview.src = URL.createObjectURL(file);
  });

  
  saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";
    
  if (!fName.value.trim()) {
    window.showToast && window.showToast("El nombre no puede estar vacío", "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar";
    return;
  }

  try {
    // Subir avatar si hay uno nuevo
    if (pendingAvatarFile) {
      const formData = new FormData();
      formData.append("avatar", pendingAvatarFile);
      const avatarRes = await fetch("http://localhost:5001/api/users/me/avatar", {
        method: "PATCH",
        credentials: "include",
        body: formData
      });
      const avatarData = await avatarRes.json();
      if (avatarData.ok) {
        document.getElementById("profileAvatar").src = avatarData.data.url_imagen;
      }
    }

    // Actualizar nombre y bio
    const body = {};
    if (fName.value.trim()) body.nombre = fName.value.trim();
    body.biografia = fBio.value.trim();

    const res = await apiPatch("/users/me", body);
    if (res.ok) {
      document.getElementById("profileNombre").textContent = res.data.user.nombre;
      document.getElementById("profileBio").textContent = res.data.user.biografia || "";
      closeModal();
      window.showToast && window.showToast("Perfil actualizado", "success");
    } else {
      window.showToast && window.showToast(res.message || "Error al guardar", "error");
    }
  } catch (err) {
      window.showToast && window.showToast("Error al guardar", "error");
  } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  });
}


async function loadProfile() {
  const params = new URLSearchParams(window.location.search);
  const nicknameParam = params.get("nickname");

  const meRes = await apiGet("/users/me");
  const isLoggedIn = meRes?.ok;

  if (!isLoggedIn) {
    window.location.replace(`/src/auth/login.html?msg=ver-usuarios`);
    return;
  }

  const isOwnProfile = !nicknameParam || meRes.data.user.nickname === nicknameParam;

  let user;

  if (isOwnProfile) {
  user = meRes.data.user;
  followers = meRes.data.followers;
  following = meRes.data.following;
  categories = meRes.data.categories;
  } else {
    const res = await apiGet(`/users/${encodeURIComponent(nicknameParam)}`);
    if (!res.ok) {
      alert('Ocurrió un error inesperado');
      window.location.href = "/";
      return;
    }
    user = res.data.user;
    followers = res.data.followers;
    following = res.data.following;
    categories = res.data.categories;
  }

  document.getElementById("profileNombre").textContent = user.nombre;
  document.getElementById("profileNickname").textContent = `@${user.nickname}`;
  document.getElementById("profileBio").textContent = user.biografia || "";
  document.getElementById("profileAvatar").src = `http://localhost:5001/api/users/${user.id}/avatar`;
  document.getElementById("profileFecha").innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
    <span>Se unió a la comunidad · ${new Date(user.fecha_creacion).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}</span>
  `;

  const nSeguidos = following?.length ?? 0;
  document.getElementById("profileSeguidos").textContent = nSeguidos;
  document.getElementById("labelSeguidos").textContent = nSeguidos === 1 ? "Seguido" : "Seguidos";
  updateSeguidoresUI();

  const editBtn = document.querySelector(".profile-edit-btn");
  if (editBtn) editBtn.style.display = isOwnProfile ? "" : "none";

  const actions = document.querySelector(".profile-actions");
  if (!isOwnProfile) {
    const misSeguidoresRes = await apiGet(`/users/${meRes.data.user.nickname}`);
    const misSeguidores = misSeguidoresRes.ok ? misSeguidoresRes.data.followers : [];
    const teSigue = misSeguidores.some(f => f.nickname === user.nickname);

    if (teSigue) {
      const row = document.querySelector(".profile-handle-row");
      const badge = document.createElement("span");
      badge.textContent = "Te sigue";
      badge.className = "follow-badge";
      row.appendChild(badge);
    }

    const followRes = await apiGet(`/users/${nicknameParam}/following`);
    let yaSiguiendo = followRes.ok && followRes.data.following;

    const btn = document.createElement("button");
    updateFollowBtn(btn, yaSiguiendo);
    actions.innerHTML = "";
    actions.appendChild(btn);

    btn.addEventListener("mouseenter", () => {
      if (yaSiguiendo) {
        btn.textContent = "Dejar de seguir";
        btn.classList.add("btn-follow--unfollow");
      }
    });

    btn.addEventListener("mouseleave", () => {
      if (yaSiguiendo) {
        updateFollowBtn(btn, true);
        btn.classList.remove("btn-follow--unfollow");
      }
    });

    btn.addEventListener("click", async () => {
      if (yaSiguiendo) {
        const prevFollowers = [...followers];
        followers = followers.filter(f => f.nickname !== meRes.data.user.nickname);
        updateSeguidoresUI();

        const res = await apiDelete(`/users/${nicknameParam}/follow`);
        if (res.ok) {
          yaSiguiendo = false;
          btn.classList.remove("btn-follow--unfollow");
          updateFollowBtn(btn, false);
          followers = new Array(res.data.seguidores);
          updateSeguidoresUI();
        } else {
          followers = prevFollowers;
          updateSeguidoresUI();
        }
      } else {
        const prevFollowers = [...followers];
        followers = [...followers, { nickname: meRes.data.user.nickname }];
        updateSeguidoresUI();

        const res = await apiPost(`/users/${nicknameParam}/follow`, {});
        if (res.ok) {
          yaSiguiendo = true;
          updateFollowBtn(btn, true);
          followers = new Array(res.data.seguidores);
          updateSeguidoresUI();
        } else {
          followers = prevFollowers;
          updateSeguidoresUI();
        }
      }
    });
  }

  // Cargar tabs
  await loadTabs(user.id, categories);

  // Editar perfil
  if (isOwnProfile) initEditModal(user);

  // Lógica de tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  const avatar = document.getElementById("profileAvatar");
  const modal = document.getElementById("avatarModal");
  const modalImg = document.getElementById("avatarModalImg");

  // Lógica de avatar
  avatar.addEventListener("click", () => {
    if (!avatar.naturalWidth) return;
    modalImg.src = avatar.src;
    modal.classList.add("open");
  });

  document.getElementById("avatarModalClose").addEventListener("click", () => {
    modal.classList.remove("open");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.classList.remove("open");
  });
}

document.addEventListener("DOMContentLoaded", loadProfile);