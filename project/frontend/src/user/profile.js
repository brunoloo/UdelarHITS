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

function openFollowModal(type, myFollowingList, meUser) {
  const modal = document.getElementById('followModal');
  const title = document.getElementById('followModalTitle');
  const list = document.getElementById('followList');
  const closeBtn = document.getElementById('followModalClose');

  const data = type === 'seguidores' ? followers : following;
  title.textContent = type === 'seguidores' ? 'Seguidores' : 'Siguiendo';

  if (data.length === 0) {
    list.innerHTML = `<div class="follow-list-empty">${
      type === 'seguidores' ? 'Todavía no tiene seguidores' : 'Todavía no sigue a nadie'
    }</div>`;
  } else {
    // Set de nicknames que yo sigo para lookup rápido
    const myFollowingSet = new Set((myFollowingList || []).map(u => u.nickname));

    list.innerHTML = data.map(u => {
      const isMe = meUser && u.nickname === meUser.nickname;
      const iFollow = myFollowingSet.has(u.nickname);

      let btnHtml = '';
      if (!isMe && meUser) {
        if (iFollow) {
          btnHtml = `<button class="btn-follow-sm btn-follow-sm--following" data-nickname="${escapeHtml(u.nickname)}">Siguiendo</button>`;
        } else {
          btnHtml = `<button class="btn-follow-sm" data-nickname="${escapeHtml(u.nickname)}">Seguir</button>`;
        }
      }

      const avatarSrc = u.url_imagen || `${SERVER_BASE}/assets/default-user.jpg`;

      return `
        <div class="follow-item">
          <img class="follow-item-avatar" src="${escapeHtml(avatarSrc)}" alt="" 
               onerror="this.src='${SERVER_BASE}/assets/default-user.jpg'" />
          <div class="follow-item-info">
            <a class="follow-item-nickname" href="/src/user/profile.html?nickname=${encodeURIComponent(u.nickname)}">@${escapeHtml(u.nickname)}</a>
            <div class="follow-item-name">${escapeHtml(u.nombre || '')}</div>
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');

    // Listeners para botones de seguir/dejar de seguir
    list.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-follow-sm');
    if (!btn || btn.disabled) return;

    const nickname = btn.dataset.nickname;
    const wasFollowing = btn.classList.contains('btn-follow-sm--following');

    // Optimista: cambiar al instante
    btn.disabled = true;
    if (wasFollowing) {
      btn.classList.remove('btn-follow-sm--following');
      btn.textContent = 'Seguir';
    } else {
      btn.classList.add('btn-follow-sm--following');
      btn.textContent = 'Siguiendo';
    }

    try {
      const res = wasFollowing
        ? await apiDelete(`/users/${encodeURIComponent(nickname)}/follow`)
        : await apiPost(`/users/${encodeURIComponent(nickname)}/follow`, {});

      if (res.ok) {
        if (wasFollowing) {
          const idx = myFollowingList.findIndex(u => u.nickname === nickname);
          if (idx !== -1) myFollowingList.splice(idx, 1);
        } else {
          myFollowingList.push({ nickname });
        }

        // Actualizar contador si estoy en mi propio perfil
        const params = new URLSearchParams(window.location.search);
        const np = params.get("nickname");
        const isOwn = !np || np === meUser.nickname;
        if (isOwn) {
          if (wasFollowing) {
            following = following.filter(u => u.nickname !== nickname);
          } else {
            following.push({ nickname });
          }
          const nSeguidos = following.length;
          document.getElementById("profileSeguidos").textContent = nSeguidos;
          document.getElementById("labelSeguidos").textContent = nSeguidos === 1 ? "Seguido" : "Seguidos";
        }
      } else {
        // Rollback si falló
        if (wasFollowing) {
          btn.classList.add('btn-follow-sm--following');
          btn.textContent = 'Siguiendo';
        } else {
          btn.classList.remove('btn-follow-sm--following');
          btn.textContent = 'Seguir';
        }
      }
    } catch (e) {
      // Rollback
      if (wasFollowing) {
        btn.classList.add('btn-follow-sm--following');
        btn.textContent = 'Siguiendo';
      } else {
        btn.classList.remove('btn-follow-sm--following');
        btn.textContent = 'Seguir';
      }
    } finally {
      btn.disabled = false;
    }
  });

  // Hover dinámico con delegación (funciona para botones que cambian de estado)
  list.addEventListener('mouseenter', (e) => {
    const btn = e.target.closest('.btn-follow-sm--following');
    if (btn) btn.textContent = 'Dejar de seguir';
  }, true);

  list.addEventListener('mouseleave', (e) => {
    const btn = e.target.closest('.btn-follow-sm');
    if (btn && btn.classList.contains('btn-follow-sm--following')) {
      btn.textContent = 'Siguiendo';
    }
  }, true);
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Cerrar
  function closeFollow() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.onclick = closeFollow;
  modal.onclick = (e) => { if (e.target === modal) closeFollow(); };
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeFollow();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
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
          <a href="/src/category/category.html?id=${encodeURIComponent(t.categoria_id)}">${t.categoria_estado === 'inactiva' ? 'Categoría inactiva' : escapeHtml(t.categoria_titulo)}</a>
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

      let destinoLabel;
      if (r.tipo === 'tema' && r.tema_estado === 'inactivo') {
        destinoLabel = 'Tema inactivo';
      } else if (r.tipo === 'categoria' && r.categoria_estado === 'inactiva') {
        destinoLabel = 'Categoría inactiva';
      } else {
        destinoLabel = escapeHtml(r.destino_titulo);
      }

      return `
      <article class="item">
        <div class="item-head">
          <span>en</span>
          <a href="${href}">${destinoLabel}</a>
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
  const removeAvatarBtn = document.getElementById("removeAvatarBtn");
  const bannerPreview = document.getElementById("editBanner");
  const bannerFileInput = document.getElementById("bannerFileInput");
  const changeBannerBtn = document.getElementById("changeBannerBtn");
  const removeBannerBtn = document.getElementById("removeBannerBtn");
  
  let pendingAvatarFile = null;
  let pendingBannerFile = null;
  let removeBanner = false;
  let removeAvatar = false;

  function openModal() {
    fName.value = document.getElementById("profileNombre").textContent;
    fBio.value = document.getElementById("profileBio").textContent;
    avatarPreview.src = document.getElementById("profileAvatar").src;
    pendingAvatarFile = null;
    pendingBannerFile = null;

    removeAvatar = false;
    avatarFileInput.value = ''; 
    removeBanner = false;
    bannerFileInput.value = '';

    // Cargar banner actual en el preview
    const currentBanner = document.getElementById("profileBannerImg");
    if (currentBanner && currentBanner.style.display !== 'none') {
      bannerPreview.style.background = `url(${currentBanner.src}) center/cover`;
    } else {
      bannerPreview.style.background = `linear-gradient(135deg, var(--accent) 0%, #4a5687 50%, #6b5d8e 100%)`;
    }

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
    nameCounter.classList.toggle("limit", fName.value.length > 50);
    bioCounter.classList.toggle("limit", fBio.value.length > 160);
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

  // Remover avatar
  removeAvatarBtn.addEventListener("click", () => {
    pendingAvatarFile = null;
    removeAvatar = true;
    avatarFileInput.value = '';
    avatarPreview.src = `${SERVER_BASE}/assets/default-user.jpg`;
  });

  changeBannerBtn.addEventListener("click", () => bannerFileInput.click());

  bannerFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingBannerFile = file;
    removeBanner = false;
    const url = URL.createObjectURL(file);
    bannerPreview.style.background = `url(${url}) center/cover`;
  });

  // Remover banner
  removeBannerBtn.addEventListener("click", () => {
    pendingBannerFile = null;
    removeBanner = true;
    bannerFileInput.value = '';
    bannerPreview.style.background = `linear-gradient(135deg, var(--accent) 0%, #4a5687 50%, #6b5d8e 100%)`;
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
    const avatarRes = await fetch(`${API_BASE}/users/me/avatar`, {
      method: "PATCH",
      credentials: "include",
      body: formData
    });
    const avatarData = await avatarRes.json();
    if (avatarData.ok) {
      document.getElementById("profileAvatar").src = avatarData.data.url_imagen;
    } else {
      window.showToast && window.showToast(avatarData.message || 'Error al subir avatar', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
      return;
    }
  } else if (removeAvatar) {
    const delRes = await apiDelete("/users/me/avatar");
    if (delRes.ok) {
      document.getElementById("profileAvatar").src = `${SERVER_BASE}/assets/default-user.jpg`;
    }
  }

  // Subir banner si hay uno nuevo
  if (pendingBannerFile) {
    const bannerFormData = new FormData();
    bannerFormData.append("banner", pendingBannerFile);
    const bannerRes = await fetch(`${API_BASE}/users/me/banner`, {
      method: "PATCH",
      credentials: "include",
      body: bannerFormData
    });
    const bannerData = await bannerRes.json();
    if (bannerData.ok) {
      const bannerImg = document.getElementById("profileBannerImg");
      bannerImg.src = bannerData.data.url_banner;
      bannerImg.style.display = 'block';
    } else {
      window.showToast && window.showToast(bannerData.message || 'Error al subir banner', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
      return;
    }
    } else if (removeBanner) {
  const delRes = await apiDelete("/users/me/banner");
  if (delRes.ok) {
    const bannerImg = document.getElementById("profileBannerImg");
    bannerImg.src = '';
    bannerImg.style.display = 'none';
  }
}

    // Actualizar nombre y bio
    const body = {};
    if (fName.value.trim()) body.nombre = fName.value.trim();
    body.biografia = fBio.value.trim();

    const res = await apiPatch("/users/me", body);
    if (res.ok) {
      document.getElementById("profileNombre").textContent = res.data.user.nombre;
      
      const bioElement = document.getElementById("profileBio");
      if (res.data.user.biografia) {
        bioElement.innerHTML = renderizarBioConLinks(res.data.user.biografia);
      } else {
        bioElement.textContent = "";
      }
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
      if (user.estado === 'inactivo') {
      document.title = 'Perfil no disponible — UdelarHITS';
      document.querySelector('.profile-card').innerHTML = `
        <div class="cat-inactive-banner" style="padding: 40px 20px; text-align: center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div class="cat-inactive-text">
            <span class="cat-inactive-title">Este perfil no está disponible</span>
            <span class="cat-inactive-desc">El contenido publicado se mantiene visible.</span>
          </div>
        </div>
      `;
      // Ocultar tabs y sidebar
      document.querySelector('.section-tabs')?.remove();
      document.querySelectorAll('.section-panel').forEach(p => p.remove());
      return;
    }
    followers = res.data.followers;
    following = res.data.following;
    categories = res.data.categories;
  }

    document.getElementById("profileNombre").textContent = user.nombre;
    document.getElementById("profileNickname").textContent = `@${user.nickname}`;
    document.title = `${user.nickname} — UdelarHITS`;
    const bioElement = document.getElementById("profileBio");
    if (user.biografia) {
      bioElement.innerHTML = renderizarBioConLinks(user.biografia);
    } else {
      bioElement.textContent = "";
    }
    document.getElementById("profileAvatar").src = user.url_imagen || `${SERVER_BASE}/assets/default-user.jpg`;
  // Banner
  const bannerImg = document.getElementById("profileBannerImg");
  if (user.url_banner) {
    bannerImg.src = user.url_banner;
    bannerImg.style.display = 'block';
  } else {
    bannerImg.style.display = 'none';
  }

  document.getElementById("profileFecha").innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    <span>Se unió a la comunidad · ${escapeHtml(new Date(user.fecha_creacion).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }))}</span>
  `;

  const nSeguidos = following?.length ?? 0;
  document.getElementById("profileSeguidos").textContent = nSeguidos;
  document.getElementById("labelSeguidos").textContent = nSeguidos === 1 ? "Seguido" : "Seguidos";
  updateSeguidoresUI();

  // Listeners para abrir modal de seguidores/seguidos
  const myFollowingList = isOwnProfile ? following : (meRes.data.following || []);
  const meUser = meRes.data.user;

  document.getElementById('btnSeguidores').addEventListener('click', () => {
    openFollowModal('seguidores', myFollowingList, meUser);
  });

  document.getElementById('btnSeguidos').addEventListener('click', () => {
    openFollowModal('seguidos', myFollowingList, meUser);
  });

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
          // Recargar datos reales de seguidores
          const updatedRes = await apiGet(`/users/${encodeURIComponent(nicknameParam)}`);
          if (updatedRes.ok) {
            followers = updatedRes.data.followers;
            following = updatedRes.data.following;
          }
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
          // Recargar datos reales de seguidores
          const updatedRes = await apiGet(`/users/${encodeURIComponent(nicknameParam)}`);
          if (updatedRes.ok) {
            followers = updatedRes.data.followers;
            following = updatedRes.data.following;
          }
          updateSeguidoresUI();
        } else {
          followers = prevFollowers;
          updateSeguidoresUI();
        }
      }
    });

    // ── Reportar usuario ──
    if (!isOwnProfile) {
      const menuWrap = document.getElementById('profileMenuWrap');
      menuWrap.style.display = '';

      const menuBtn = menuWrap.querySelector('.comment-menu-btn');
      const dropdown = document.getElementById('profileDropdown');

      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });

      document.addEventListener('click', () => dropdown.classList.remove('open'));

      document.getElementById('reportProfileBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('open');

        const modal = document.getElementById('reportUserModal');
        const input = document.getElementById('reportMotiveInput');
        const counter = document.getElementById('reportMotiveCounter');
        const errorEl = document.getElementById('reportUserError');
        const submitBtn = document.getElementById('submitReportUser');
        const cancelBtn = document.getElementById('cancelReportUser');
        const closeBtn = document.getElementById('closeReportUserModal');

        input.value = '';
        errorEl.textContent = '';
        counter.textContent = '0 / 1000';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviar reporte';
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';

        const close = () => {
          modal.classList.remove('open');
          document.body.style.overflow = '';
        };

        closeBtn.onclick = close;
        cancelBtn.onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };

        input.oninput = () => {
          counter.textContent = input.value.length + ' / 1000';
          submitBtn.disabled = input.value.trim().length < 10;
        };

        submitBtn.onclick = async () => {
          errorEl.textContent = '';
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando...';

          const res = await apiPost(`/user-reports/${encodeURIComponent(nicknameParam)}/report`, {
            motivo: input.value.trim()
          });

          if (res.ok) {
            close();
            window.showToast?.('Reporte enviado correctamente', 'success');
          } else {
            errorEl.textContent = res.message || 'Error al enviar el reporte';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar reporte';
          }
        };
      });
    }
  }

  // Cargar tabs
  const isPrivateProfile = user.privado && !isOwnProfile;
  let canViewContent = true;

  if (isPrivateProfile) {
    const isAdmin = meRes?.ok && meRes.data.user.rol === 'admin';
    const iFollow = followers.some(f => f.nickname === meRes.data.user.nickname);

    if (!isAdmin && !iFollow) {
      canViewContent = false;
    }
  }

    if (!canViewContent) {
    document.getElementById('btnSeguidores').style.pointerEvents = 'none';
    document.getElementById('btnSeguidos').style.pointerEvents = 'none';
  }

  if (canViewContent) {
    await loadTabs(user.id, categories);
  } else {
    // Mostrar mensaje de cuenta privada en todas las tabs
    document.getElementById('panelCategorias').innerHTML = `
      <div class="empty-panel" style="grid-column:1/-1; text-align: center; padding: 32px 16px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <p style="color: var(--text-muted); font-size: 14px; margin: 0;">Esta cuenta es privada. Solo sus seguidores pueden ver su contenido.</p>
      </div>
    `;
    document.getElementById('panelTemas').innerHTML = document.getElementById('panelCategorias').innerHTML;
    document.getElementById('panelComentarios').innerHTML = document.getElementById('panelCategorias').innerHTML;
    document.getElementById('countCategorias').textContent = '—';
    document.getElementById('countTemas').textContent = '—';
    document.getElementById('countComentarios').textContent = '—';
  }

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

  // Lógica de banner modal
  const profileBannerImg = document.getElementById("profileBannerImg");
  const bannerModal = document.getElementById("bannerModal");
  const bannerModalImg = document.getElementById("bannerModalImg");

  profileBannerImg.addEventListener("click", () => {
    if (profileBannerImg.style.display === 'none') return;
    bannerModalImg.src = profileBannerImg.src;
    bannerModal.classList.add("open");
  });

  document.getElementById("bannerModalClose").addEventListener("click", () => {
    bannerModal.classList.remove("open");
  });

  bannerModal.addEventListener("click", (e) => {
    if (e.target === bannerModal) bannerModal.classList.remove("open");
  });

}

document.addEventListener("DOMContentLoaded", loadProfile);